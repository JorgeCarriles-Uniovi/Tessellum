use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::{Instant, UNIX_EPOCH};
use walkdir::WalkDir;

use crate::commands::extract_wikilinks;
use crate::db::Database;
use crate::models::FileIndex;

/// Statistics about the indexing operation.
#[derive(Debug, Clone)]
pub struct IndexStats {
    pub files_indexed: usize,
    pub files_deleted: usize,
    pub files_skipped: usize,
    pub duration_ms: u128,
}

/// Vault indexer for syncing database with filesystem.
pub struct VaultIndexer;

impl VaultIndexer {
    /// Perform a full sync of the vault with the database.
    ///
    /// This function:
    /// 1. Walks the vault directory to find all .md files
    /// 2. Compares with the database to find new/modified/deleted files
    /// 3. Indexes new and modified files
    /// 4. Removes deleted files from the database
    pub async fn full_sync(db: &Database, vault_path: &str) -> Result<IndexStats, String> {
        let start = Instant::now();

        let mut files_indexed = 0;
        let mut files_deleted = 0;
        let mut files_skipped = 0;


        // 1. Get all .md files from filesystem with their modified times
        let fs_files = Self::collect_filesystem_files(vault_path)?;

        // 2. Get all indexed files from database
        let db_files: HashMap<String, i64> = db
            .get_all_indexed_files()
            .await
            .map_err(|e| format!("Failed to get indexed files: {}", e))?
            .into_iter()
            .collect();

        // 3. Build file index for link resolution
        let file_index = FileIndex::build(vault_path)
            .map_err(|e| format!("Failed to build file index: {}", e))?;

        // 4. Process each filesystem file
        for (path, modified_time) in &fs_files {
            let needs_index = match db_files.get(path) {
                None => true,                                       // New file
                Some(&db_modified) => *modified_time > db_modified, // Modified file
            };

            if needs_index {
                match Self::index_single_file(db, vault_path, path, &file_index).await {
                    Ok(_) => files_indexed += 1,
                    Err(e) => {
                        eprintln!("   ⚠ Failed to index {}: {}", path, e);
                    }
                }
            } else {
                files_skipped += 1;
            }
        }

        // 5. Find and delete files that no longer exist
        let fs_paths: std::collections::HashSet<&String> = fs_files.keys().collect();
        let deleted_paths: Vec<String> = db_files
            .keys()
            .filter(|p| !fs_paths.contains(p))
            .cloned()
            .collect();

        if !deleted_paths.is_empty() {
            files_deleted = db
                .batch_delete_files(&deleted_paths)
                .await
                .map_err(|e| format!("Failed to delete files: {}", e))?;
        }

        let duration_ms = start.elapsed().as_millis();

        Ok(IndexStats {
            files_indexed,
            files_deleted,
            files_skipped,
            duration_ms,
        })
    }

    /// Collect all .md files from the filesystem with their modified times.
    fn collect_filesystem_files(vault_path: &str) -> Result<HashMap<String, i64>, String> {
        let mut files = HashMap::new();

        if !Path::new(vault_path).exists() {
            return Err("Vault path does not exist".to_string());
        }

        for entry in WalkDir::new(vault_path).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            let path_str = path.to_string_lossy().to_string();

            // Skip hidden files/dirs and trash
            if path_str.contains(".git") || path_str.contains(".trash") {
                continue;
            }

            // Only process .md files
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                if let Ok(metadata) = fs::metadata(path) {
                    let modified_time = metadata
                        .modified()
                        .unwrap_or(UNIX_EPOCH)
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs() as i64;

                    files.insert(path_str, modified_time);
                }
            }
        }

        Ok(files)
    }

    /// Index a single file: read content, extract links, update database.
    async fn index_single_file(
        db: &Database,
        vault_path: &str,
        file_path: &str,
        file_index: &FileIndex,
    ) -> Result<(), String> {
        // Read file content
        let content =
            fs::read_to_string(file_path).map_err(|e| format!("Failed to read file: {}", e))?;

        // Get file metadata
        let metadata =
            fs::metadata(file_path).map_err(|e| format!("Failed to get metadata: {}", e))?;

        let size = metadata.len();
        let modified = metadata
            .modified()
            .map_err(|e| format!("Failed to get modified time: {}", e))?
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        // Extract and resolve wikilinks
        let wikilinks = extract_wikilinks(&content);
        let resolved_links: Vec<String> = wikilinks
            .iter()
            .filter_map(|link| {
                file_index
                    .resolve(vault_path, &link.target)
                    .map(|p| p.to_string_lossy().to_string())
            })
            .collect();

        // Index the file
        db.index_file(file_path, modified, size, &resolved_links)
            .await
            .map_err(|e| format!("Failed to index file: {}", e))?;

        Ok(())
    }
}
