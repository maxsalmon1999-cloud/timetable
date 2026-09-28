//! Read-only access to the Mac's calendars (everything Calendar.app shows:
//! iCloud, Google, Exchange, …) through Apple's EventKit framework.

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalEvent {
    id: String,
    title: String,
    calendar: String,
    color: String,
    /// epoch milliseconds; the frontend converts to local day + minutes
    start: f64,
    end: f64,
    all_day: bool,
    /// shown in the hover card; None when empty
    location: Option<String>,
    notes: Option<String>,
}

/// "granted" | "notDetermined" | "denied" | "restricted" | "writeOnly" | "unsupported"
#[tauri::command]
pub async fn calendar_access_status() -> String {
    imp::status().into()
}

/// Shows the macOS permission prompt if she hasn't answered it yet. Returns whether access is granted.
#[tauri::command]
pub async fn calendar_request_access() -> bool {
    imp::request_access()
}

#[tauri::command]
pub async fn calendar_events(start_ms: f64, end_ms: f64) -> Result<Vec<CalEvent>, String> {
    let events = imp::events(start_ms, end_ms)?;
    eprintln!("calendar_events: {} events", events.len());
    Ok(events)
}

#[tauri::command]
pub fn open_calendar_privacy_settings() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars")
        .spawn();
}

#[cfg(target_os = "macos")]
mod imp {
    use super::CalEvent;
    use block2::RcBlock;
    use objc2::{available, rc::Retained, runtime::Bool};
    use objc2_app_kit::{NSColor, NSColorSpace};
    use objc2_event_kit::{EKAuthorizationStatus, EKCalendarType, EKEntityType, EKEventStore};
    use objc2_foundation::{NSArray, NSDate, NSError, NSString};
    use std::sync::mpsc;

    pub fn status() -> &'static str {
        let s = unsafe { EKEventStore::authorizationStatusForEntityType(EKEntityType::Event) };
        match s {
            EKAuthorizationStatus::FullAccess => "granted",
            EKAuthorizationStatus::NotDetermined => "notDetermined",
            EKAuthorizationStatus::Denied => "denied",
            EKAuthorizationStatus::Restricted => "restricted",
            EKAuthorizationStatus::WriteOnly => "writeOnly",
            _ => "denied",
        }
    }

    pub fn request_access() -> bool {
        if status() == "granted" {
            return true;
        }
        let store = unsafe { EKEventStore::new() };
        let (tx, rx) = mpsc::channel();
        let block = RcBlock::new(move |granted: Bool, _err: *mut NSError| {
            let _ = tx.send(granted.as_bool());
        });
        let handler = RcBlock::as_ptr(&block);
        unsafe {
            if available!(macos = 14.0) {
                store.requestFullAccessToEventsWithCompletion(handler);
            } else {
                #[allow(deprecated)]
                store.requestAccessToEntityType_completion(EKEntityType::Event, handler);
            }
        }
        // blocks this worker thread (not the UI) until she answers the prompt
        rx.recv().unwrap_or(false)
    }

    fn hex(color: &NSColor) -> String {
        let Some(c) = color.colorUsingColorSpace(&NSColorSpace::sRGBColorSpace()) else {
            return "#8A8F98".into();
        };
        let to = |v: f64| (v.clamp(0.0, 1.0) * 255.0).round() as u8;
        format!("#{:02X}{:02X}{:02X}", to(c.redComponent()), to(c.greenComponent()), to(c.blueComponent()))
    }

    pub fn events(start_ms: f64, end_ms: f64) -> Result<Vec<CalEvent>, String> {
        if status() != "granted" {
            return Err("no-access".into());
        }
        unsafe {
            let store = EKEventStore::new();
            // everything except the auto-generated Birthdays calendar
            let calendars: Vec<_> = store
                .calendarsForEntityType(EKEntityType::Event)
                .iter()
                .filter(|c| c.r#type() != EKCalendarType::Birthday)
                .collect();
            if calendars.is_empty() {
                return Ok(vec![]);
            }
            let calendars = NSArray::from_retained_slice(&calendars);
            let start = NSDate::dateWithTimeIntervalSince1970(start_ms / 1000.0);
            let end = NSDate::dateWithTimeIntervalSince1970(end_ms / 1000.0);
            let predicate = store.predicateForEventsWithStartDate_endDate_calendars(&start, &end, Some(&calendars));

            let found: Vec<Retained<_>> = store.eventsMatchingPredicate(&predicate).iter().collect();
            Ok(found
                .iter()
                .map(|e| {
                    let start = e.startDate().timeIntervalSince1970() * 1000.0;
                    let cal = e.calendar();
                    let text = |s: Option<Retained<NSString>>| s.map(|s| s.to_string().trim().to_string()).filter(|s| !s.is_empty());
                    CalEvent {
                        // recurring events share an identifier, so add the occurrence start
                        id: format!("{}@{}", e.eventIdentifier().map(|s| s.to_string()).unwrap_or_default(), start),
                        title: e.title().to_string(),
                        calendar: cal.as_ref().map(|c| c.title().to_string()).unwrap_or_default(),
                        color: cal.as_ref().map(|c| hex(&c.color())).unwrap_or_else(|| "#8A8F98".into()),
                        start,
                        end: e.endDate().timeIntervalSince1970() * 1000.0,
                        all_day: e.isAllDay(),
                        location: text(e.location()),
                        notes: text(e.notes()),
                    }
                })
                .collect())
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    use super::CalEvent;
    pub fn status() -> &'static str {
        "unsupported"
    }
    pub fn request_access() -> bool {
        false
    }
    pub fn events(_: f64, _: f64) -> Result<Vec<CalEvent>, String> {
        Err("unsupported".into())
    }
}
