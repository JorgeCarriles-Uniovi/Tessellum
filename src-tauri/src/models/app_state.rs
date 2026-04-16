use notify::RecommendedWatcher;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::db::Database;
use crate::models::{AssetIndex, FileIndex};
use crate::search::SearchIndex;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SearchReadinessStatus {
    Idle,
    Warming,
    Ready,
    Failed,
}

#[derive(Clone, Debug)]
pub struct SearchReadinessState {
    pub status: SearchReadinessStatus,
    pub attempt_count: u32,
    pub max_attempts: u32,
    pub last_error: Option<String>,
    pub vault_path: Option<String>,
}

impl Default for SearchReadinessState {
    fn default() -> Self {
        Self {
            status: SearchReadinessStatus::Idle,
            attempt_count: 0,
            max_attempts: 10,
            last_error: None,
            vault_path: None,
        }
    }
}

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
///   The `Database` is wrapped in an `Arc` for shared ownership across threads.
///   Internally, sqlx handles concurrent access through its connection pool.
///
/// * `file_index` - Cached FileIndex to resolve links quickly without traversing the FS.
/// * `asset_index` - Cached AssetIndex for media embeds.
pub struct AppState {
    pub watcher: tokio::sync::Mutex<Option<RecommendedWatcher>>,
    pub db: Arc<Database>,
    pub file_index: Arc<Mutex<Option<FileIndex>>>,
    pub asset_index: Arc<Mutex<Option<AssetIndex>>>,
    pub search_index: Arc<Mutex<SearchIndex>>,
    pub search_readiness: Mutex<SearchReadinessState>,
}

impl AppState {
    pub fn new(db: Database, search_index: SearchIndex) -> Self {
        Self {
            db: Arc::new(db),
            watcher: tokio::sync::Mutex::new(None),
            file_index: Arc::new(Mutex::new(None)),
            asset_index: Arc::new(Mutex::new(None)),
            search_index: Arc::new(Mutex::new(search_index)),
            search_readiness: Mutex::new(SearchReadinessState::default()),
        }
    }
}
