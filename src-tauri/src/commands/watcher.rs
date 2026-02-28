use notify::{Config, Error, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

use crate::models::AppState;

/// Debounce window: ignore events within this duration of the last emit.
const DEBOUNCE_MS: u64 = 200;

/// Watches a directory and emits a debounced event to the frontend whenever
/// a file within the directory changes.
///
/// This function initializes a file system watcher for the specified directory (`vault_path`) and listens for changes
/// such as file creation, modification, or deletion. Upon detecting a change, the function emits a `file-changed`
/// event to the frontend, debounced to prevent event flooding.
#[tauri::command]
pub fn watch_vault(
    vault_path: String,
    handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Initialize the watcher
    let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
    
    if watcher_guard.is_some() {
        return Ok(());
    }
    
    let app_handle_clone = handle.clone();
    let notify_config = Config::default();
    let last_emit = Arc::new(Mutex::new(
        Instant::now() - Duration::from_millis(DEBOUNCE_MS),
    ));
    
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, Error>| {
            match res {
                Ok(_) => {
                    // Debounce: only emit if enough time has passed
                    let mut last = last_emit.lock().unwrap();
                    if last.elapsed() >= Duration::from_millis(DEBOUNCE_MS) {
                        *last = Instant::now();
                        let _ = app_handle_clone.emit("file-changed", ());
                    }
                }
                Err(e) => log::error!("watch error: {:?}", e),
            }
        },
        notify_config,
    )
        .map_err(|e| e.to_string())?;
    
    watcher
        .watch(Path::new(&vault_path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    
    *watcher_guard = Some(watcher);
    
    Ok(())
}
