use notify::RecommendedWatcher;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::db::Database;
use crate::models::FileIndex;


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
///
/// * `file_index` - Cached FileIndex to resolve links quickly without traversing the FS.
pub struct AppState {
    pub watcher: std::sync::Mutex<Option<RecommendedWatcher>>,
    pub db: Arc<Mutex<Option<Database>>>,
    pub file_index: Arc<Mutex<Option<FileIndex>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            db: Arc::new(Mutex::new(None)),
            watcher: std::sync::Mutex::new(None),
            file_index: Arc::new(Mutex::new(None)),
        }
    }
}
