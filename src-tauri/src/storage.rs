//! Crash-safe local storage for the timetable.
//!
//! Everything lives in ~/Documents/Timetable Plans/ (falls back to the app data dir if
//! Documents isn't accessible):
//!   timetable.json            the current plans
//!   Backups/timetable-YYYY-MM-DD.json   one snapshot per day, newest 60 kept
//!
//! Writes go to a temp file, are flushed to disk, then renamed over the real file,
//! so a crash or power cut mid-save can never leave a half-written file.
//! If the main file is ever unreadable it is moved aside (never overwritten) and
//! the newest good backup is restored.

use serde::Serialize;
use serde_json::Value;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Manager, State};

const FILE: &str = "timetable.json";
const BACKUP_DIR: &str = "Backups";
const KEEP_BACKUPS: usize = 60;

pub struct Storage {
    dir: PathBuf,
    legacy: Option<PathBuf>,
    lock: Mutex<()>,
}

impl Storage {
    pub fn new(app: &AppHandle) -> Self {
        let app_data = app.path().app_data_dir().ok();
        let documents = app.path().document_dir().ok().map(|d| d.join("Timetable Plans"));
        let dir = documents
            .filter(|d| fs::create_dir_all(d).is_ok())
            .or_else(|| app_data.clone().filter(|d| fs::create_dir_all(d).is_ok()))
            .unwrap_or_else(|| PathBuf::from("."));
        // earlier versions kept data in the app data dir
        let legacy = app_data.map(|d| d.join(FILE)).filter(|p| *p != dir.join(FILE));
        Storage { dir, legacy, lock: Mutex::new(()) }
    }

    fn main_file(&self) -> PathBuf {
        self.dir.join(FILE)
    }

    fn backup_dir(&self) -> PathBuf {
        self.dir.join(BACKUP_DIR)
    }

    fn backups(&self) -> Vec<PathBuf> {
        let mut files: Vec<PathBuf> = fs::read_dir(self.backup_dir())
            .map(|rd| {
                rd.filter_map(|e| e.ok().map(|e| e.path()))
                    .filter(|p| {
                        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                        name.starts_with("timetable-") && name.ends_with(".json")
                    })
                    .collect()
            })
            .unwrap_or_default();
        files.sort(); // names are dated, so this is oldest → newest
        files
    }
}

/// Parse a file and check it looks like our data. Accepts the old
/// plugin-store shape `{ "data": { … } }` too.
fn read_valid(path: &Path) -> Option<Value> {
    let text = fs::read_to_string(path).ok()?;
    let mut v: Value = serde_json::from_str(&text).ok()?;
    if let Some(inner) = v.get_mut("data") {
        v = inner.take();
    }
    looks_valid(&v).then_some(v)
}

fn looks_valid(v: &Value) -> bool {
    v.get("activities").is_some_and(Value::is_array)
        && v.get("blocks").is_some_and(Value::is_array)
        && v.get("templates").is_some_and(Value::is_array)
}

fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let tmp = path.with_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    fs::rename(&tmp, path)?;
    if let Some(parent) = path.parent() {
        // make the rename itself durable
        if let Ok(d) = fs::File::open(parent) {
            let _ = d.sync_all();
        }
    }
    Ok(())
}

fn err(context: &str, e: impl std::fmt::Display) -> String {
    format!("{context}: {e}")
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Loaded {
    data: Option<Value>,
    /// set when the main file was missing/damaged and a backup was used
    restored_from: Option<String>,
    folder: String,
}

#[tauri::command]
pub fn load_data(st: State<Storage>) -> Result<Loaded, String> {
    let _guard = st.lock.lock().unwrap_or_else(|e| e.into_inner());
    let main = st.main_file();
    let folder = st.dir.display().to_string();

    if main.exists() {
        if let Some(v) = read_valid(&main) {
            return Ok(Loaded { data: Some(v), restored_from: None, folder });
        }
        // damaged: keep it for inspection rather than ever overwriting it
        let stamp = chrono::Local::now().format("%Y-%m-%d-%H%M%S");
        let aside = st.dir.join(format!("timetable-damaged-{stamp}.json"));
        fs::rename(&main, &aside).map_err(|e| err("Could not move damaged file aside", e))?;
    }

    for backup in st.backups().iter().rev() {
        if let Some(v) = read_valid(backup) {
            let bytes = serde_json::to_vec_pretty(&v).map_err(|e| err("Could not encode backup", e))?;
            write_atomic(&main, &bytes).map_err(|e| err("Could not restore backup", e))?;
            let name = backup.file_stem().and_then(|n| n.to_str()).unwrap_or("backup").to_string();
            return Ok(Loaded { data: Some(v), restored_from: Some(name), folder });
        }
    }

    if let Some(v) = st.legacy.as_deref().and_then(read_valid) {
        return Ok(Loaded { data: Some(v), restored_from: None, folder });
    }

    Ok(Loaded { data: None, restored_from: None, folder })
}

#[tauri::command]
pub fn save_data(data: Value, st: State<Storage>) -> Result<(), String> {
    if !looks_valid(&data) {
        return Err("Refusing to save data in an unexpected shape".into());
    }
    let bytes = serde_json::to_vec_pretty(&data).map_err(|e| err("Could not encode data", e))?;
    let _guard = st.lock.lock().unwrap_or_else(|e| e.into_inner());

    write_atomic(&st.main_file(), &bytes).map_err(|e| err("Could not save", e))?;

    // today's snapshot always holds the latest state of the day
    let backup_dir = st.backup_dir();
    fs::create_dir_all(&backup_dir).map_err(|e| err("Could not create Backups folder", e))?;
    let today = chrono::Local::now().format("%Y-%m-%d");
    write_atomic(&backup_dir.join(format!("timetable-{today}.json")), &bytes)
        .map_err(|e| err("Could not write backup", e))?;

    let backups = st.backups();
    if backups.len() > KEEP_BACKUPS {
        for old in &backups[..backups.len() - KEEP_BACKUPS] {
            let _ = fs::remove_file(old);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn reveal_data_folder(st: State<Storage>) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&st.dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| err("Could not open folder", e))
}
