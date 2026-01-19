use std::path::{Component, Path};
use sqlx::sqlite::{Sqlite, SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Pool};

pub struct Database {
	pool: Pool<Sqlite>,
}

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
			);"
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
            );"
		)
			.execute(&pool)
			.await?;
		
		Ok(Self { pool })
		
	}
	
	pub async fn index_file(
		&self, path: &str,
		modified: i64,
		size: u64,
		links: &[String]
		) -> Result<(), sqlx::Error> {
		sqlx::query(
			"INSERT INTO notes (path, modified_at, size) VALUES (?, ?, ?)
					ON CONFLICT(path) DO UPDATE SET modified_at = ?, size = ?"
		)
			.bind(path).bind(modified).bind(size as i64)
			.bind(modified).bind(size as i64)
			.execute(&self.pool).await?;
		
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
		let rows = sqlx::query_as::<_, (String, String)>(
			"SELECT source_path, target_path FROM links"
		)
			.fetch_all(&self.pool)
			.await?;
		
		Ok(rows)
	}
	
}

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
			_ => return false, // Rejects: ParentDir (..), RootDir (/), CurDir (.)
		}
	}
	
	// 3. (Optional) Block special characters if you want strict filenames
	// For now, we just care about traversal attacks.
	true
}