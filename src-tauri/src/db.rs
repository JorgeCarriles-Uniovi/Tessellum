use sqlx::Pool;
use sqlx::sqlite::{Sqlite, SqliteConnectOptions, SqlitePoolOptions};

pub struct Database {
    pool: Pool<Sqlite>,
}

/// Initializes a new database connection pool and creates the necessary tables if they do not exist.
impl Database {
    pub async fn init(db_path: &str) -> Result<Self, sqlx::Error> {
        let options = SqliteConnectOptions::new()
            .filename(db_path)
            .create_if_missing(true);
        
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await?;
        
        // Create notes table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS notes (
                path TEXT PRIMARY KEY,
                modified_at INTEGER,
                size INTEGER,
                frontmatter TEXT
            );",
        )
            .execute(&pool)
            .await?;
        
        // Migrate table if missing the new column (fails silently if column already exists)
        let _ = sqlx::query("ALTER TABLE notes ADD COLUMN frontmatter TEXT;")
            .execute(&pool)
            .await;
        
        let _ = sqlx::query("ALTER TABLE notes ADD COLUMN inline_tags TEXT;")
            .execute(&pool)
            .await;
        
        // Create links table with RESOLVED target paths
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS links (
                source_path TEXT,
                target_path TEXT,
                PRIMARY KEY (source_path, target_path),
                FOREIGN KEY(source_path) REFERENCES notes(path) ON DELETE CASCADE
            );",
        )
            .execute(&pool)
            .await?;
        
        // Create index for faster backlink queries
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_path);")
            .execute(&pool)
            .await?;
        
        // Enable foreign key enforcement (SQLite has it OFF by default)
        sqlx::query("PRAGMA foreign_keys = ON;")
            .execute(&pool)
            .await?;
        
        Ok(Self { pool })
    }
    
    /// Index a file with its metadata and resolved wikilinks.
    ///
    /// # Arguments
    ///
    /// * `path` - The full path to the source file
    /// * `modified` - Unix timestamp of last modification
    /// * `size` - File size in bytes
    /// * `resolved_links` - Vector of FULL PATHS to target files (already resolved from wikilinks)
    pub async fn index_file(
        &self,
        path: &str,
        modified: i64,
        size: u64,
        frontmatter_json: Option<&str>,
        inline_tags_json: Option<&str>,
        resolved_links: &[String],
    ) -> Result<(), sqlx::Error> {
        // Insert or update the note metadata
        sqlx::query(
            "INSERT INTO notes (path, modified_at, size, frontmatter, inline_tags) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(path) DO UPDATE SET modified_at = ?, size = ?, frontmatter = ?, inline_tags = ?",
        )
            .bind(path)
            .bind(modified)
            .bind(size as i64)
            .bind(frontmatter_json)
            .bind(inline_tags_json)
            .bind(modified)
            .bind(size as i64)
            .bind(frontmatter_json)
            .bind(inline_tags_json)
            .execute(&self.pool)
            .await?;
        
        // Update links in a transaction
        let mut tx = self.pool.begin().await?;
        
        // Delete old links from this source
        sqlx::query("DELETE FROM links WHERE source_path = ?")
            .bind(path)
            .execute(&mut *tx)
            .await?;
        
        // Deduplicate links - a note can have multiple wikilinks to the same target,
        // but we only store one link relationship per source-target pair
        let mut unique_links: Vec<&String> = resolved_links.iter().collect();
        unique_links.sort();
        unique_links.dedup();
        
        // Insert new resolved links (deduplicated)
        for target_path in unique_links {
            sqlx::query("INSERT INTO links (source_path, target_path) VALUES (?, ?)")
                .bind(path)
                .bind(target_path)
                .execute(&mut *tx)
                .await?;
        }
        
        tx.commit().await?;
        Ok(())
    }
    
    /// Get all outgoing links from a specific file.
    ///
    /// Returns a vector of full paths to files that this file links to.
    pub async fn get_outgoing_links(&self, source_path: &str) -> Result<Vec<String>, sqlx::Error> {
        let denormalized = source_path.replace('/', "\\");
        let rows = sqlx::query_as::<_, (String,)>(
            "SELECT target_path FROM links WHERE source_path = ? OR source_path = ?",
        )
            .bind(source_path)
            .bind(&denormalized)
            .fetch_all(&self.pool)
            .await?;
        
        Ok(rows
            .into_iter()
            .map(|(path,)| crate::utils::normalize_path(&path))
            .collect())
    }
    
    /// Get all backlinks to a specific file.
    ///
    /// Returns a vector of full paths to files that link to this file.
    pub async fn get_backlinks(&self, target_path: &str) -> Result<Vec<String>, sqlx::Error> {
        let denormalized = target_path.replace('/', "\\");
        let rows = sqlx::query_as::<_, (String,)>(
            "SELECT source_path FROM links WHERE target_path = ? OR target_path = ?",
        )
            .bind(target_path)
            .bind(&denormalized)
            .fetch_all(&self.pool)
            .await?;
        
        Ok(rows
            .into_iter()
            .map(|(path,)| crate::utils::normalize_path(&path))
            .collect())
    }
    
    /// Get all links in the vault (for graph visualization).
    ///
    /// Returns a vector of (source_path, target_path) tuples.
    pub async fn get_all_links(&self) -> Result<Vec<(String, String)>, sqlx::Error> {
        let rows =
            sqlx::query_as::<_, (String, String)>("SELECT source_path, target_path FROM links")
                .fetch_all(&self.pool)
                .await?;
        
        Ok(rows)
    }
    
    /// Update links when a file is renamed/moved.
    ///
    /// This updates both:
    /// 1. Links FROM this file (update source_path)
    /// 2. Links TO this file (update target_path)
    pub async fn update_file_path(
        &self,
        old_path: &str,
        new_path: &str,
    ) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        
        // Defer FK checks until commit so we can safely update the notes PK
        // and then update the referencing links.source_path in the same transaction.
        sqlx::query("PRAGMA defer_foreign_keys = ON")
            .execute(&mut *tx)
            .await?;
        
        // 1. Update the record for the file/folder itself
        // Use OR REPLACE for notes PK in case of orphaned DB entries
        sqlx::query("UPDATE OR REPLACE notes SET path = ? WHERE path = ?")
            .bind(new_path)
            .bind(old_path)
            .execute(&mut *tx)
            .await?;
        
        // 2. If this is a folder rename, update all child notes
        // Note: paths are normalized with forward slashes
        let old_prefix = format!("{}/%", old_path.replace('\\', "/"));
        sqlx::query(
            "UPDATE OR REPLACE notes SET path = ? || substr(path, length(?) + 1)
             WHERE path LIKE ?",
        )
            .bind(new_path)
            .bind(old_path)
            .bind(&old_prefix)
            .execute(&mut *tx)
            .await?;
        
        // 3. Update links where this file/folder is the source
        // Handles exact match
        sqlx::query("UPDATE OR IGNORE links SET source_path = ? WHERE source_path = ?")
            .bind(new_path)
            .bind(old_path)
            .execute(&mut *tx)
            .await?;
        
        // Handles children if folder
        sqlx::query(
            "UPDATE OR IGNORE links SET source_path = ? || substr(source_path, length(?) + 1)
             WHERE source_path LIKE ?",
        )
            .bind(new_path)
            .bind(old_path)
            .bind(&old_prefix)
            .execute(&mut *tx)
            .await?;
        
        // Cleanup merged source links (ones that didn't update because of conflicts)
        sqlx::query("DELETE FROM links WHERE source_path = ? OR source_path LIKE ?")
            .bind(old_path)
            .bind(&old_prefix)
            .execute(&mut *tx)
            .await?;
        
        // 4. Update links where this file/folder is the target (backlinks)
        // Handles exact match
        sqlx::query("UPDATE OR IGNORE links SET target_path = ? WHERE target_path = ?")
            .bind(new_path)
            .bind(old_path)
            .execute(&mut *tx)
            .await?;
        
        // Handles children if folder
        sqlx::query(
            "UPDATE OR IGNORE links SET target_path = ? || substr(target_path, length(?) + 1)
             WHERE target_path LIKE ?",
        )
            .bind(new_path)
            .bind(old_path)
            .bind(&old_prefix)
            .execute(&mut *tx)
            .await?;
        
        // Cleanup merged target links
        sqlx::query("DELETE FROM links WHERE target_path = ? OR target_path LIKE ?")
            .bind(old_path)
            .bind(&old_prefix)
            .execute(&mut *tx)
            .await?;
        
        tx.commit().await?;
        Ok(())
    }
    
    /// Delete a file from the index.
    ///
    /// This also removes all outgoing links from this file due to CASCADE constraints.
    pub async fn delete_file(&self, path: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM notes WHERE path = ?")
            .bind(path)
            .execute(&self.pool)
            .await?;
        
        Ok(())
    }
    
    /// Delete all files from the index whose path starts with the given prefix.
    ///
    /// Useful for removing all notes inside a directory that was trashed.
    pub async fn delete_files_by_prefix(&self, prefix: &str) -> Result<usize, sqlx::Error> {
        let result = sqlx::query("DELETE FROM notes WHERE path LIKE ?")
            .bind(format!("{}%", prefix))
            .execute(&self.pool)
            .await?;
        
        Ok(result.rows_affected() as usize)
    }
    
    /// Get all orphaned files (files with no incoming or outgoing links).
    pub async fn get_orphaned_files(&self) -> Result<Vec<String>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (String,)>(
            "SELECT path FROM notes
             WHERE path NOT IN (SELECT DISTINCT source_path FROM links)
             AND path NOT IN (SELECT DISTINCT target_path FROM links)
             AND replace(path, '/', '\\') NOT IN (SELECT DISTINCT target_path FROM links)",
        )
            .fetch_all(&self.pool)
            .await?;
        
        Ok(rows.into_iter().map(|(path,)| path).collect())
    }
    
    /// Get broken links (links pointing to non-existent files).
    ///
    /// Returns a vector of (source_path, broken_target_path) tuples.
    pub async fn get_broken_links(&self) -> Result<Vec<(String, String)>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (String, String)>(
            "SELECT source_path, target_path FROM links
             WHERE target_path NOT IN (SELECT path FROM notes)",
        )
            .fetch_all(&self.pool)
            .await?;
        
        Ok(rows)
    }
    
    /// Get all indexed file paths with their modified times.
    ///
    /// Returns a vector of (path, modified_at) tuples for comparison with filesystem.
    pub async fn get_all_indexed_files(&self) -> Result<Vec<(String, i64)>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (String, i64)>("SELECT path, modified_at FROM notes")
            .fetch_all(&self.pool)
            .await?;
        
        Ok(rows)
    }
    
    /// Delete multiple files from the index in a single transaction.
    ///
    /// More efficient than calling delete_file multiple times.
    pub async fn batch_delete_files(&self, paths: &[String]) -> Result<usize, sqlx::Error> {
        if paths.is_empty() {
            return Ok(0);
        }
        
        let mut tx = self.pool.begin().await?;
        let mut deleted = 0;
        
        for path in paths {
            let result = sqlx::query("DELETE FROM notes WHERE path = ?")
                .bind(path)
                .execute(&mut *tx)
                .await?;
            deleted += result.rows_affected() as usize;
        }
        
        tx.commit().await?;
        Ok(deleted)
    }
    
    /// Get frontmatter JSON for a specific file.
    pub async fn get_frontmatter(&self, path: &str) -> Result<Option<String>, sqlx::Error> {
        let row =
            sqlx::query_as::<_, (Option<String>,)>("SELECT frontmatter FROM notes WHERE path = ?")
                .bind(path)
                .fetch_optional(&self.pool)
                .await?;
        
        Ok(row.and_then(|(frontmatter,)| frontmatter))
    }
    
    /// Get all unique tags from frontmatter metadata and inline tags across all notes.
    pub async fn get_all_tags(&self) -> Result<Vec<String>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (Option<String>, Option<String>)>(
            "SELECT frontmatter, inline_tags FROM notes WHERE frontmatter IS NOT NULL OR inline_tags IS NOT NULL",
        )
            .fetch_all(&self.pool)
            .await?;
        
        let mut all_tags = std::collections::HashSet::new();
        
        for (frontmatter_opt, inline_tags_opt) in rows {
            // Process frontmatter tags
            if let Some(frontmatter_json) = frontmatter_opt {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&frontmatter_json) {
                    if let Some(tags) = parsed.get("tags") {
                        if let Some(tags_array) = tags.as_array() {
                            for tag in tags_array {
                                if let Some(tag_str) = tag.as_str() {
                                    all_tags.insert(tag_str.to_string());
                                }
                            }
                        } else if let Some(tag_str) = tags.as_str() {
                            // Support strings (e.g. tags: tag1, tag2)
                            for t in tag_str.split(',') {
                                let normalized = t.trim().trim_start_matches('#');
                                if !normalized.is_empty() {
                                    all_tags.insert(normalized.to_string());
                                }
                            }
                        }
                    }
                }
            }
            
            // Process inline tags
            if let Some(inline_tags_json) = inline_tags_opt {
                if let Ok(parsed) = serde_json::from_str::<Vec<String>>(&inline_tags_json) {
                    for tag in parsed {
                        all_tags.insert(tag);
                    }
                }
            }
        }
        
        let mut sorted_tags: Vec<String> = all_tags.into_iter().collect();
        sorted_tags.sort();
        Ok(sorted_tags)
    }
    
    /// Get all tags for each indexed file
    pub async fn get_files_tags(
        &self,
    ) -> Result<std::collections::HashMap<String, Vec<String>>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
            "SELECT path, frontmatter, inline_tags FROM notes",
        )
            .fetch_all(&self.pool)
            .await?;
        
        let mut result = std::collections::HashMap::new();
        
        for (path, frontmatter_opt, inline_tags_opt) in rows {
            let mut file_tags = Vec::new();
            
            if let Some(frontmatter_json) = frontmatter_opt {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&frontmatter_json) {
                    if let Some(tags) = parsed.get("tags") {
                        if let Some(tags_array) = tags.as_array() {
                            for tag in tags_array {
                                if let Some(tag_str) = tag.as_str() {
                                    file_tags.push(tag_str.to_string());
                                }
                            }
                        } else if let Some(tag_str) = tags.as_str() {
                            for t in tag_str.split(',') {
                                file_tags.push(t.trim().to_string());
                            }
                        }
                    }
                }
            }
            
            if let Some(inline_tags_json) = inline_tags_opt {
                if let Ok(parsed) = serde_json::from_str::<Vec<String>>(&inline_tags_json) {
                    for tag in parsed {
                        if !file_tags.contains(&tag) {
                            file_tags.push(tag);
                        }
                    }
                }
            }
            
            result.insert(path, file_tags);
        }
        
        Ok(result)
    }
    
    /// Get all unique property keys from frontmatter metadata across all notes.
    pub async fn get_all_property_keys(&self) -> Result<Vec<String>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (Option<String>,)>(
            "SELECT frontmatter FROM notes WHERE frontmatter IS NOT NULL",
        )
            .fetch_all(&self.pool)
            .await?;
        
        let mut all_keys = std::collections::HashSet::new();
        
        for (frontmatter_opt,) in rows {
            if let Some(frontmatter_json) = frontmatter_opt {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&frontmatter_json) {
                    if let Some(obj) = parsed.as_object() {
                        for key in obj.keys() {
                            all_keys.insert(key.clone());
                        }
                    }
                }
            }
        }
        
        let mut sorted_keys: Vec<String> = all_keys.into_iter().collect();
        sorted_keys.sort();
        Ok(sorted_keys)
    }
}
