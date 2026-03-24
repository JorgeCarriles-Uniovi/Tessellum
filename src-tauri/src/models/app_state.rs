use notify::RecommendedWatcher;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::db::Database;
use crate::models::{AssetIndex, FileIndex};
use crate::search::SearchIndex;

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
/// * `asset_index` - Cached AssetIndex for media embeds.
pub struct AppState {
    pub watcher: tokio::sync::Mutex<Option<RecommendedWatcher>>,
    pub db: Arc<Mutex<Database>>,
    pub file_index: Arc<Mutex<Option<FileIndex>>>,
    pub asset_index: Arc<Mutex<Option<AssetIndex>>>,
    pub search_index: Arc<Mutex<SearchIndex>>,
}

impl AppState {
    pub fn new(db: Database, search_index: SearchIndex) -> Self {
        Self {
            db: Arc::new(Mutex::new(db)),
            watcher: tokio::sync::Mutex::new(None),
            file_index: Arc::new(Mutex::new(None)),
            asset_index: Arc::new(Mutex::new(None)),
            search_index: Arc::new(Mutex::new(search_index)),
        }
    }
}
