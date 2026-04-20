use serde::Serialize;
use tauri::State;

use crate::error::TessellumError;
use crate::indexer::{IndexStats, VaultIndexer};
use crate::grafeo_projection::{sync_full, ManagedGrafeoConnection};
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
    kuzu_state: State<'_, ManagedGrafeoConnection>,
    vault_path: String,
) -> Result<SyncResult, TessellumError> {
    run_sync_vault(state.inner(), kuzu_state.inner(), &vault_path).await
}

pub async fn run_sync_vault(
    state: &AppState,
    grafeo_state: &ManagedGrafeoConnection,
    vault_path: &str,
) -> Result<SyncResult, TessellumError> {
    let db = state.db.clone();
    let search_index = state.search_index.clone();
    
    match VaultIndexer::full_sync(db.as_ref(), search_index, vault_path).await {
        Ok(stats) => {
            // Only do full Grafeo sync if this is an initial/manual sync with many changes
            // Individual note changes are synced incrementally via write_file command
            let total_changes = stats.files_indexed + stats.files_deleted;
            if total_changes > 10 {
                if let Err(err) = sync_full(grafeo_state, db.as_ref()).await {
                    log::warn!(
                        "Grafeo sync_full failed after vault sync for '{}': {}",
                        vault_path,
                        err
                    );
                }
            }
            let mut idx_guard = state.file_index.lock().await;
            *idx_guard = None;
            let mut asset_guard = state.asset_index.lock().await;
            *asset_guard = None;
            Ok(SyncResult::from(stats))
        }
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
