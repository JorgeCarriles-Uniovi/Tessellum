use notify::RecommendedWatcher;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::db::Database;

/// Represents the application state that contains shared resources such as
/// a file watcher and a database connection.
///
/// # Fields
///
/// * `watcher` - A thread-safe, optional wrapper around a `RecommendedWatcher` instance.
///   This watcher is typically used for monitoring file system events.
///   It is wrapped in a `Mutex` to ensure safe concurrent access across threads.
///
/// * `db` - A thread-safe, optional shared reference to a `Database` instance.
///   The `Database` is wrapped in both an `Arc` for shared ownership across threads
///   and a `Mutex` to provide mutable access, ensuring thread-safe operations.
pub struct AppState {
    pub watcher: std::sync::Mutex<Option<RecommendedWatcher>>,
    pub db: Arc<Mutex<Option<Database>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            db: Arc::new(Mutex::new(None)),
            watcher: std::sync::Mutex::new(None),
        }
    }
}
