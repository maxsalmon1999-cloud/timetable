mod calendar;
mod storage;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      app.manage(storage::Storage::new(app.handle()));
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      storage::load_data,
      storage::save_data,
      storage::reveal_data_folder,
      calendar::calendar_access_status,
      calendar::calendar_request_access,
      calendar::calendar_events,
      calendar::open_calendar_privacy_settings
    ])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
