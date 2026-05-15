use notify::{Config, Error, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

use crate::error::TessellumError;
use crate::models::AppState;

/// Debounce window: ignore events within this duration of the last emit.
const DEBOUNCE_MS: u64 = 200;

fn should_emit_change(last_emit: &mut Instant, now: Instant) -> bool {
    if now.duration_since(*last_emit) < Duration::from_millis(DEBOUNCE_MS) {
        return false;
    }

    *last_emit = now;
    true
}

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
    // Initialize or replace the watcher so vault switching and dev reloads
    // do not keep stale watchers alive.
    let mut watcher_guard = state.watcher.lock().await;
    *watcher_guard = None;

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
                    let now = Instant::now();
                    if should_emit_change(&mut last, now) {

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

#[tauri::command]
pub async fn unwatch_vault(state: State<'_, AppState>) -> Result<(), TessellumError> {
    let mut watcher_guard = state.watcher.lock().await;
    *watcher_guard = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant};

    use super::should_emit_change;

    #[test]
    fn emits_when_the_debounce_window_has_elapsed() {
        let base = Instant::now();
        let mut last_emit = base - Duration::from_millis(250);

        let emitted = should_emit_change(&mut last_emit, base);

        assert!(emitted);
        assert_eq!(last_emit, base);
    }

    #[test]
    fn suppresses_events_inside_the_debounce_window() {
        let base = Instant::now();
        let mut last_emit = base - Duration::from_millis(50);

        let emitted = should_emit_change(&mut last_emit, base);

        assert!(!emitted);
        assert!(base.duration_since(last_emit) < Duration::from_millis(200));
    }
}
