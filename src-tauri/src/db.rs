use sqlx::sqlite::{Sqlite, SqliteConnectOptions, SqlitePoolOptions};
use sqlx::Pool;
use std::path::{Component, Path};

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
                size INTEGER
            );",
        )
            .execute(&pool)
            .await?;
        
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
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_path);",
        )
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
        resolved_links: &[String],
    ) -> Result<(), sqlx::Error> {
        // Insert or update the note metadata
        sqlx::query(
            "INSERT INTO notes (path, modified_at, size) VALUES (?, ?, ?)
             ON CONFLICT(path) DO UPDATE SET modified_at = ?, size = ?",
        )
            .bind(path)
            .bind(modified)
            .bind(size as i64)
            .bind(modified)
            .bind(size as i64)
            .execute(&self.pool)
            .await?;
        
        // Update links in a transaction
        let mut tx = self.pool.begin().await?;
        
        // Delete old links from this source
        sqlx::query("DELETE FROM links WHERE source_path = ?")
            .bind(path)
            .execute(&mut *tx)
            .await?;
        
        println!("Reached here");
        
        // Insert new resolved links
        for target_path in resolved_links {
            // Validate that the target path is safe
            
            sqlx::query("INSERT INTO links (source_path, target_path) VALUES (?, ?)")
                .bind(path)
                .bind(target_path)
                .execute(&mut *tx)
                .await?;
            println!("Reached here 2");
        }
        
        tx.commit().await?;
        Ok(())
    }
    
    /// Get all outgoing links from a specific file.
    ///
    /// Returns a vector of full paths to files that this file links to.
    pub async fn get_outgoing_links(&self, source_path: &str) -> Result<Vec<String>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (String,)>(
            "SELECT target_path FROM links WHERE source_path = ?"
        )
            .bind(source_path)
            .fetch_all(&self.pool)
            .await?;
        
        Ok(rows.into_iter().map(|(path,)| path).collect())
    }
    
    /// Get all backlinks to a specific file.
    ///
    /// Returns a vector of full paths to files that link to this file.
    pub async fn get_backlinks(&self, target_path: &str) -> Result<Vec<String>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (String,)>(
            "SELECT source_path FROM links WHERE target_path = ?"
        )
            .bind(target_path)
            .fetch_all(&self.pool)
            .await?;
        
        Ok(rows.into_iter().map(|(path,)| path).collect())
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
    pub async fn update_file_path(&self, old_path: &str, new_path: &str) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        
        // Update the note's primary key
        sqlx::query("UPDATE notes SET path = ? WHERE path = ?")
            .bind(new_path)
            .bind(old_path)
            .execute(&mut *tx)
            .await?;
        
        // Update links where this file is the source
        sqlx::query("UPDATE links SET source_path = ? WHERE source_path = ?")
            .bind(new_path)
            .bind(old_path)
            .execute(&mut *tx)
            .await?;
        
        // Update links where this file is the target (backlinks)
        sqlx::query("UPDATE links SET target_path = ? WHERE target_path = ?")
            .bind(new_path)
            .bind(old_path)
            .execute(&mut *tx)
            .await?;
        
        tx.commit().await?;
        Ok(())
    }
    
    /// Delete a file from the index.
    ///
    /// This also removes all links from/to this file due to CASCADE constraints.
    pub async fn delete_file(&self, path: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM notes WHERE path = ?")
            .bind(path)
            .execute(&self.pool)
            .await?;
        
        Ok(())
    }
    
    /// Get all orphaned files (files with no incoming or outgoing links).
    pub async fn get_orphaned_files(&self) -> Result<Vec<String>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (String,)>(
            "SELECT path FROM notes
             WHERE path NOT IN (SELECT DISTINCT source_path FROM links)
             AND path NOT IN (SELECT DISTINCT target_path FROM links)"
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
             WHERE target_path NOT IN (SELECT path FROM notes)"
        )
            .fetch_all(&self.pool)
            .await?;
        
        Ok(rows)
    }
}

/// Validates if a given path is safe to use (prevents directory traversal attacks).
///
/// This function checks that the path:
/// 1. Is not empty or whitespace-only
/// 2. Does not contain ".." (parent directory) components
/// 3. Does not contain root directory components
///
/// # Arguments
///
/// * `path_str` - A string slice representing the path to validate
///
/// # Returns
///
/// * `true` if the path is considered safe
/// * `false` if the path is empty, contains invalid components, or is deemed unsafe
fn is_safe_path(path_str: &str) -> bool {
    let path = Path::new(path_str);
    
    println!("Path: {}", path_str);
    
    // Prevent empty strings
    if path_str.trim().is_empty() {
        return false;
    }
    
    // Check for directory traversal attempts
    for component in path.components() {
        match component {
            Component::Normal(_) => continue, // Regular path components are fine
            _ => return false,                // Reject: ParentDir (..), RootDir (/), etc.
        }
    }
    
    true
}

/// Validates if a given string input is safe to use as a filename.
///
/// This is a stricter check than is_safe_path, specifically for filenames.
fn is_safe_filename(input: &str) -> bool {
    let path = Path::new(input);
    
    // Prevent empty strings
    if input.trim().is_empty() {
        return false;
    }
    
    // Filename should not contain path separators
    if input.contains('/') || input.contains('\\') {
        return false;
    }
    
    // Check that it only contains one Normal component
    let components: Vec<_> = path.components().collect();
    if components.len() != 1 {
        return false;
    }
    
    matches!(components[0], Component::Normal(_))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_is_safe_path() {
        assert!(is_safe_path("valid/path/to/file.md"));
        assert!(is_safe_path("file.md"));
        assert!(is_safe_path("folder/subfolder/note.md"));
        
        assert!(!is_safe_path(""));
        assert!(!is_safe_path("   "));
        assert!(!is_safe_path("../etc/passwd"));
        assert!(!is_safe_path("/etc/passwd"));
        assert!(!is_safe_path("folder/../../../etc/passwd"));
    }
    
    #[test]
    fn test_is_safe_filename() {
        assert!(is_safe_filename("note.md"));
        assert!(is_safe_filename("my-note_123.md"));
        
        assert!(!is_safe_filename(""));
        assert!(!is_safe_filename("folder/note.md"));
        assert!(!is_safe_filename("../note.md"));
        assert!(!is_safe_filename("note\\file.md"));
    }
}