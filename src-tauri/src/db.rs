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

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS notes (
				path TEXT PRIMARY KEY,
                modified_at INTEGER,
                size INTEGER
			);",
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS links (
                source_path TEXT,
                target_path TEXT,
                PRIMARY KEY (source_path, target_path),
                FOREIGN KEY(source_path) REFERENCES notes(path) ON DELETE
                CASCADE
            );",
        )
        .execute(&pool)
        .await?;

        Ok(Self { pool })
    }

    pub async fn index_file(
        &self,
        path: &str,
        modified: i64,
        size: u64,
        links: &[String],
    ) -> Result<(), sqlx::Error> {
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

        let mut tx = self.pool.begin().await?;

        sqlx::query("DELETE FROM links WHERE source_path = ?")
            .bind(path)
            .execute(&mut *tx)
            .await?;

        for target in links {
            if !is_safe_filename(&target) {
                continue;
            }

            let clean_target = if target.ends_with(".md") {
                target
            } else {
                &format!("{}.md", target)
            };

            sqlx::query("INSERT INTO links (source_path, target_path) VALUES (?, ?)")
                .bind(path)
                .bind(target)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn get_all_links(&self) -> Result<Vec<(String, String)>, sqlx::Error> {
        let rows =
            sqlx::query_as::<_, (String, String)>("SELECT source_path, target_path FROM links")
                .fetch_all(&self.pool)
                .await?;

        Ok(rows)
    }
}

/// Validates if a given string input is safe to use as a filename.
///
/// This function performs checks to ensure the provided input does not pose
/// security risks such as directory traversal attacks. Specifically:
///
/// 1. Rejects empty or whitespace-only strings.
/// 2. Disallows any path components that are not considered "normal" (e.g., rejects `..`, `/`, or `.` components).
///
/// # Arguments
///
/// * `input` - A string slice that represents the filename or path to validate.
///
/// # Returns
///
/// * `true` if the filename is considered safe.
/// * `false` if the filename is empty, contains invalid path components, or is deemed unsafe.
///
/// # Example
///
/// ```rust
/// use std::path::Path;
/// use std::path::Component;
///
/// fn is_safe_filename(input: &str) -> bool {
///     let path = Path::new(input);
///
///     // Prevent empty strings
///     if input.trim().is_empty() {
///         return false;
///     }
///
///     // Iterate over path components to check for ".." (ParentDir) or RootDir
///     for component in path.components() {
///         match component {
///             Component::Normal(_) => continue, // Regular text is fine
///             _ => return false,                // Rejects: ParentDir (..), RootDir (/), CurDir (.)
///         }
///     }
///
///     // Allow filenames free of traversal concerns
///     true
/// }
///
/// assert_eq!(is_safe_filename("valid_filename.txt"), true);
/// assert_eq!(is_safe_filename("../unsafe_filename.txt"), false);
/// assert_eq!(is_safe_filename(""), false);
/// assert_eq!(is_safe_filename("/etc/passwd"), false);
/// ```
fn is_safe_filename(input: &str) -> bool {
    let path = Path::new(input);

    // 1. Prevent empty strings
    if input.trim().is_empty() {
        return false;
    }

    // 2. Iterate over path components to check for ".." (ParentDir) or RootDir
    for component in path.components() {
        match component {
            Component::Normal(_) => continue, // Regular text is fine
            _ => return false,                // Rejects: ParentDir (..), RootDir (/), CurDir (.)
        }
    }

    // 3. (Optional) Block special characters if you want strict filenames
    // For now, we just care about traversal attacks.
    true
}
