use sqlx::sqlite::{Sqlite, SqlitePool, SqlitePoolOptions};
use sqlx::{Pool, Executor};
use sqlx::migrate::MigrateDatabase;

pub struct Database {
	pool: Pool<Sqlite>,
}

impl Database {
	
	pub async fn init(db_path: &str) -> Result<Self, sqlx::Error> {
		
		if !Sqlite::database_exists(db_path).await.unwrap_or(false) {
			Sqlite::create_database(db_path).await?;
		}
		
		let pool = SqlitePoolOptions::new()
			.max_connections(5)
			.connect(db_path)
			.await?;
		
		sqlx::query(
			"CREATE TABLE IF NOT EXISTS notes (
				path TEXT PRIMARY KEY,
                modified_at INTEGER,
                size INTEGER 
			);
			CREATE TABLE IF NOT EXISTS links (
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
	
	pub async fn index_file(&self, path: &str, modified: i64, size: u64,
		links: &Vec<String>) -> Result<(), sqlx::Error> {
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