use sqlx::sqlite::{Sqlite, SqliteConnectOptions, SqlitePoolOptions};
use sqlx::Pool;

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
        let rows =
            sqlx::query_as::<_, (String,)>("SELECT target_path FROM links WHERE source_path = ?")
                .bind(source_path)
                .fetch_all(&self.pool)
                .await?;
        
        Ok(rows.into_iter().map(|(path,)| path).collect())
    }
    
    /// Get all backlinks to a specific file.
    ///
    /// Returns a vector of full paths to files that link to this file.
    pub async fn get_backlinks(&self, target_path: &str) -> Result<Vec<String>, sqlx::Error> {
        let rows =
            sqlx::query_as::<_, (String,)>("SELECT source_path FROM links WHERE target_path = ?")
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
    pub async fn update_file_path(
        &self,
        old_path: &str,
        new_path: &str,
    ) -> Result<(), sqlx::Error> {
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
             AND path NOT IN (SELECT DISTINCT target_path FROM links)",
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
}
