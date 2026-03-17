use notify::{Config, Error, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

use crate::error::TessellumError;
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
pub async fn watch_vault(
    vault_path: String,
    handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), TessellumError> {
    // Initialize the watcher
    let mut watcher_guard = state.watcher.lock().await;
    
    if watcher_guard.is_some() {
        return Ok(());
    }
    
    let app_handle_clone = handle.clone();
    let file_index_clone = state.file_index.clone();
    let asset_index_clone = state.asset_index.clone();
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
                        
                        // Invalidate caches
                        let fi = file_index_clone.clone();
                        let ai = asset_index_clone.clone();
                        tauri::async_runtime::spawn(async move {
                            let mut guard = fi.lock().await;
                            *guard = None;
                            let mut asset_guard = ai.lock().await;
                            *asset_guard = None;
                        });
                        
                        let _ = app_handle_clone.emit("file-changed", ());
                    }
                }
                Err(e) => log::error!("watch error: {:?}", e),
            }
        },
        notify_config,
    )
        .map_err(|e| TessellumError::Internal(e.to_string()))?;
    
    watcher
        .watch(Path::new(&vault_path), RecursiveMode::Recursive)
        .map_err(|e| TessellumError::Internal(e.to_string()))?;
    
    *watcher_guard = Some(watcher);
    
    Ok(())
}
