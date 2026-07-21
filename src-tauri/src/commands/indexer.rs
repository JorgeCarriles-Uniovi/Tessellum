use serde::Serialize;
use std::sync::atomic::Ordering;
use std::time::UNIX_EPOCH;
use tauri::State;

use crate::error::TessellumError;
use crate::indexer::{IndexStats, VaultIndexer};
use crate::grafeo_projection::{sync_full, ManagedGrafeoConnection};
use crate::models::AppState;
use crate::utils::is_hidden_or_special;

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
    // Prevent concurrent full_sync calls: the filesystem watcher can race with
    // a manual rebuild. compare_exchange returns Ok only if the flag was false,
    // which means we are the one to proceed. Any concurrent caller returns early.
    if state.sync_in_progress
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        log::info!("sync_vault: another sync is already in progress for '{}' — skipping", vault_path);
        return Ok(SyncResult {
            success: true,
            files_indexed: 0,
            files_deleted: 0,
            files_skipped: 0,
            duration_ms: 0,
            error: None,
        });
    }

    let db = state.db.clone();
    let search_index = state.search_index.clone();

    let result = match VaultIndexer::full_sync(db.as_ref(), search_index, vault_path).await {
        Ok(stats) => {
            // Only do full Grafeo sync if this is an initial/manual sync with many changes
            // Individual note changes are synced incrementally via write_file command
            let total_changes = stats.files_indexed + stats.files_deleted;
            if total_changes > 10
                && let Err(err) = sync_full(grafeo_state, db.as_ref()).await {
                    log::warn!(
                        "Grafeo sync_full failed after vault sync for '{}': {}",
                        vault_path,
                        err
                    );
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
    };

    // Always clear the flag, even on error, so future syncs can proceed.
    state.sync_in_progress.store(false, Ordering::Release);

    result
}

/// Index status returned to the frontend.
#[derive(Serialize, Clone)]
pub struct IndexStatus {
    pub indexed: u64,
    pub total: u64,
    pub stale: u64,
    pub sync_in_progress: bool,
}

/// Return current index status without scanning the full vault.
///
/// - `indexed`: markdown files recorded in the DB
/// - `total`: markdown files found on disk
/// - `stale`: files on disk whose mtime is newer than what the DB recorded
#[tauri::command]
pub async fn get_index_status(
    state: State<'_, AppState>,
    vault_path: String,
) -> Result<IndexStatus, TessellumError> {
    let sync_in_progress = state.sync_in_progress.load(Ordering::Acquire);

    let indexed = state.db.count_indexed_markdown_files().await
        .unwrap_or(0) as u64;

    // Quick disk walk to count markdown files and stale ones
    let db_files: std::collections::HashMap<String, i64> = state.db
        .get_all_search_files()
        .await
        .unwrap_or_default()
        .into_iter()
        .filter(|(_, _, is_md, _)| *is_md != 0)
        .map(|(path, modified, _, _)| (path, modified))
        .collect();

    let mut total: u64 = 0;
    let mut stale: u64 = 0;

    if let Ok(entries) = walkdir::WalkDir::new(&vault_path)
        .into_iter()
        .collect::<Result<Vec<_>, _>>()
    {
        for entry in entries {
            let path = entry.path();
            let rel = path.strip_prefix(&vault_path).unwrap_or(path);
            if is_hidden_or_special(rel) { continue; }
            if path.extension().and_then(|s| s.to_str()) != Some("md") { continue; }
            if !path.is_file() { continue; }

            total += 1;
            let path_str = crate::utils::normalize_path(&path.to_string_lossy());
            if let Ok(meta) = std::fs::metadata(path) {
                let disk_mtime = meta.modified()
                    .unwrap_or(UNIX_EPOCH)
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;
                match db_files.get(&path_str) {
                    None => stale += 1,
                    Some(&db_mtime) if disk_mtime > db_mtime => stale += 1,
                    _ => {}
                }
            }
        }
    }

    Ok(IndexStatus {
        indexed,
        total,
        stale,
        sync_in_progress,
    })
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::{run_sync_vault, SyncResult};
    use crate::db::Database;
    use crate::grafeo_projection::ManagedGrafeoConnection;
    use crate::models::{AppState, AssetIndex, FileIndex};
    use crate::search::SearchIndex;
    use crate::test_support::TestVault;

    #[test]
    fn sync_result_maps_index_stats_fields() {
        let result = SyncResult::from(crate::indexer::IndexStats {
            files_indexed: 2,
            files_deleted: 1,
            files_skipped: 3,
            duration_ms: 42,
        });

        assert!(result.success);
        assert_eq!(result.files_indexed, 2);
        assert_eq!(result.files_deleted, 1);
        assert_eq!(result.files_skipped, 3);
        assert_eq!(result.duration_ms, 42);
        assert_eq!(result.error, None);
    }

    #[tokio::test]
    async fn run_sync_vault_returns_success_and_invalidates_cached_indexes() {
        let vault = TestVault::new()
            .with_markdown("Inbox/Alpha.md", "# Alpha")
            .with_markdown("Inbox/Beta.md", "# Beta")
            .build();
        let db_dir = tempdir().unwrap();
        let db = Database::init(db_dir.path().join("indexer-command.sqlite").to_str().unwrap())
            .await
            .unwrap();
        let search_dir = tempdir().unwrap();
        let state = AppState::new(
            db,
            SearchIndex::open_or_create(&search_dir.path().join("search-index")).unwrap(),
        );
        let grafeo_state = ManagedGrafeoConnection::default();

        *state.file_index.lock().await = Some(FileIndex::build(vault.path().to_str().unwrap()).unwrap());
        *state.asset_index.lock().await = Some(AssetIndex::build(vault.path().to_str().unwrap()).unwrap());

        let result = run_sync_vault(&state, &grafeo_state, vault.path().to_str().unwrap())
            .await
            .unwrap();

        assert!(result.success);
        assert_eq!(result.files_indexed, 2);
        assert!(state.file_index.lock().await.is_none());
        assert!(state.asset_index.lock().await.is_none());
    }
}
