use serde::Serialize;
use tauri::State;

use crate::indexer::{IndexStats, VaultIndexer};
use crate::models::AppState;

/// Response from the sync_vault command.
#[derive(Serialize)]
pub struct SyncResult {
    pub success: bool,
    pub files_indexed: usize,
    pub files_deleted: usize,
    pub files_skipped: usize,
    pub duration_ms: u128,
    pub error: Option<String>,
}

impl From<IndexStats> for SyncResult {
    fn from(stats: IndexStats) -> Self {
        Self {
            success: true,
            files_indexed: stats.files_indexed,
            files_deleted: stats.files_deleted,
            files_skipped: stats.files_skipped,
            duration_ms: stats.duration_ms,
            error: None,
        }
    }
}

/// Synchronize the vault database with the filesystem.
///
/// This command should be called by the frontend after loading the vault path.
/// It scans all .md files, indexes new/modified files, and removes deleted files.
#[tauri::command]
pub async fn sync_vault(
    state: State<'_, AppState>,
    vault_path: String,
) -> Result<SyncResult, String> {
    let db_guard = state.db.lock().await;

    let db = db_guard.as_ref().ok_or("Database not initialized")?;

    match VaultIndexer::full_sync(db, &vault_path).await {
        Ok(stats) => Ok(SyncResult::from(stats)),
        Err(e) => Ok(SyncResult {
            success: false,
            files_indexed: 0,
            files_deleted: 0,
            files_skipped: 0,
            duration_ms: 0,
            error: Some(e),
        }),
    }
}
