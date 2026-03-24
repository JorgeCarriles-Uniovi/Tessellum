use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::{Instant, UNIX_EPOCH};
use walkdir::WalkDir;

use crate::commands::extract_wikilinks;
use crate::db::Database;
use crate::models::FileIndex;
use crate::search::SearchDoc;
use crate::search::SearchIndex;
use crate::utils::{extract_tags, is_hidden_or_special};

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
    pub async fn full_sync(
        db: &Database,
        search_index: std::sync::Arc<tokio::sync::Mutex<SearchIndex>>,
        vault_path: &str,
    ) -> Result<IndexStats, String> {
        let start = Instant::now();
        
        let mut files_indexed = 0;
        let mut files_deleted = 0;
        let mut files_skipped = 0;
        
        log::info!("Starting vault sync for: {}", vault_path);
        
        // 1. Get all files from filesystem with their modified times
        let fs_files = Self::collect_filesystem_files(vault_path)?;
        log::debug!("Found {} files in filesystem", fs_files.len());
        
        // 2. Get all indexed search files from database
        let db_files: HashMap<String, (i64, bool)> = db
            .get_all_search_files()
            .await
            .map_err(|e| format!("Failed to get indexed files: {}", e))?
            .into_iter()
            .map(|(path, modified, is_markdown)| (path, (modified, is_markdown != 0)))
            .collect();
        log::debug!("Found {} files in database", db_files.len());
        
        // 3. Build file index for link resolution
        let file_index = FileIndex::build(vault_path)
            .map_err(|e| format!("Failed to build file index: {}", e))?;
        
        // 4. Process each filesystem file
        let mut docs_to_index: Vec<SearchDoc> = Vec::new();
        
        for (path, (modified_time, is_markdown)) in &fs_files {
            let needs_index = match db_files.get(path) {
                None => true,                                                 // New file
                Some((db_modified, _)) => *modified_time > *db_modified, // Modified file
            };
            
            if needs_index {
                if *is_markdown {
                    match Self::index_single_file(db, vault_path, path, &file_index, &mut docs_to_index).await {
                        Ok(_) => files_indexed += 1,
                        Err(e) => {
                            log::warn!("Failed to index {}: {}", path, e);
                        }
                    }
                } else {
                    let title = Path::new(path)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    docs_to_index.push(SearchDoc {
                        path: path.clone(),
                        title,
                        body: String::new(),
                        tags: Vec::new(),
                    });
                    db.upsert_search_file(path, *modified_time, false)
                        .await
                        .map_err(|e| format!("Failed to update search file: {}", e))?;
                    files_indexed += 1;
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
            log::debug!("Removing {} deleted files from index", deleted_paths.len());
            let mut markdown_deleted: Vec<String> = Vec::new();
            for path in &deleted_paths {
                if let Some((_, is_md)) = db_files.get(path) {
                    if *is_md {
                        markdown_deleted.push(path.clone());
                    }
                }
            }
            if !markdown_deleted.is_empty() {
                files_deleted = db
                    .batch_delete_files(&markdown_deleted)
                    .await
                    .map_err(|e| format!("Failed to delete files: {}", e))?;
            }
            db.delete_search_files(&deleted_paths)
                .await
                .map_err(|e| format!("Failed to delete search files: {}", e))?;
        }
        
        // Update search index in batch
        if !docs_to_index.is_empty() || !deleted_paths.is_empty() {
            let docs = docs_to_index.clone();
            let deletes = deleted_paths.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let guard = tauri::async_runtime::block_on(search_index.lock());
                guard
                    .index_batch(&docs, &deletes)
                    .map_err(|e| format!("Failed to update search index: {}", e))
            })
                .await
                .map_err(|e| format!("Search index task failed: {}", e))??;
        }
        
        let duration_ms = start.elapsed().as_millis();
        
        log::info!(
            "Vault sync complete in {}ms: {} indexed, {} skipped, {} deleted",
            duration_ms,
            files_indexed,
            files_skipped,
            files_deleted
        );
        
        Ok(IndexStats {
            files_indexed,
            files_deleted,
            files_skipped,
            duration_ms,
        })
    }
    
    /// Collect all files from the filesystem with their modified times.
    fn collect_filesystem_files(
        vault_path: &str,
    ) -> Result<HashMap<String, (i64, bool)>, String> {
        let mut files = HashMap::new();
        
        if !Path::new(vault_path).exists() {
            return Err("Vault path does not exist".to_string());
        }
        
        for entry in WalkDir::new(vault_path).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            let path_str = path.to_string_lossy().to_string();
            
            // Skip hidden files/dirs (.git, .trash, etc.)
            let rel_path = path.strip_prefix(vault_path).unwrap_or(path);
            if is_hidden_or_special(rel_path) {
                continue;
            }
            
            if path.is_file() {
                let is_markdown = path.extension().and_then(|s| s.to_str()) == Some("md");
                if let Ok(metadata) = fs::metadata(path) {
                    let modified_time = metadata
                        .modified()
                        .unwrap_or(UNIX_EPOCH)
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs() as i64;
                    
                    files.insert(crate::utils::normalize_path(&path_str), (modified_time, is_markdown));
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
        docs_to_index: &mut Vec<SearchDoc>,
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
        
        // Parse frontmatter
        let mut frontmatter_json_str = None;
        let mut body_content = content.as_str();
        
        if let Some((yaml, _)) = crate::utils::frontmatter::parse_frontmatter(&content) {
            body_content = crate::utils::frontmatter::strip_frontmatter(&content);
            if let Ok(json) = crate::utils::frontmatter::frontmatter_to_json(&yaml) {
                frontmatter_json_str = Some(json);
            }
        }
        
        let inline_tags = extract_tags(&content);
        
        let inline_tags_json_str = if inline_tags.is_empty() {
            None
        } else {
            serde_json::to_string(&inline_tags).ok()
        };
        
        let wikilinks = extract_wikilinks(body_content);
        let resolved_links: Vec<String> = wikilinks
            .iter()
            .map(|link| {
                crate::utils::normalize_path(
                    &file_index
                        .resolve_or_default(vault_path, &link.target)
                        .to_string_lossy(),
                )
            })
            .collect();
        
        let normalized_path = crate::utils::normalize_path(file_path);
        // Index the file
        db.index_file(
            &normalized_path,
            modified,
            size,
            frontmatter_json_str.as_deref(),
            inline_tags_json_str.as_deref(),
            &resolved_links,
        )
            .await
            .map_err(|e| format!("Failed to index file: {}", e))?;
        
        db.set_note_tags(&normalized_path, &inline_tags)
            .await
            .map_err(|e| format!("Failed to update note tags: {}", e))?;
        
        db.upsert_search_file(&normalized_path, modified, true)
            .await
            .map_err(|e| format!("Failed to update search file: {}", e))?;
        
        let title = Path::new(file_path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
            .trim_end_matches(".md")
            .to_string();
        
        docs_to_index.push(SearchDoc {
            path: normalized_path,
            title,
            body: body_content.to_string(),
            tags: inline_tags,
        });
        
        Ok(())
    }
}
