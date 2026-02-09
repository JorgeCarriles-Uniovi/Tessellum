use notify::{Config, Error, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use tauri::{AppHandle, Emitter, State};

use crate::models::AppState;

/// Watches a directory and emits an event to the frontend whenever a file within the directory changes.
///
/// This function initializes a file system watcher for the specified directory (`vault_path`) and listens for changes
/// such as file creation, modification, or deletion. Upon detecting a change, the function emits a `file-changed`
/// event to the frontend.
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

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, Error>| {
            match res {
                Ok(_res) => {
                    // Emit event to frontend
                    let _ = app_handle_clone.emit("file-changed", ());
                }
                Err(e) => println!("watch error: {:?}", e),
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
