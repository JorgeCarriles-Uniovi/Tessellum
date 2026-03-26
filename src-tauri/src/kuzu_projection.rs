use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use kuzu::{Connection, Database, SystemConfig};
use serde_json::{Map, Value as JsonValue};
use tauri::Manager;

use crate::db::Database as SqliteConnection;

pub type ManagedKuzuConnection = Connection<'static>;

const CREATE_NOTE_TABLE: &str = r#"
CREATE NODE TABLE Note (
  id STRING,
  title STRING,
  tags STRING[],
  PRIMARY KEY (id)
);
"#;

const CREATE_REL_TABLE: &str = r#"
CREATE REL TABLE Relation (
  FROM Note TO Note
);
"#;

const BLOCKED_WRITE_KEYWORDS: [&str; 7] = ["CREATE", "SET", "DELETE", "MERGE", "DROP", "ALTER", "COPY"];

pub fn init_managed_connection(
	app_handle: &tauri::AppHandle,
	sqlite: &SqliteConnection,
) -> Result<ManagedKuzuConnection, String> {
	let graph_path = app_handle
		.path()
		.app_data_dir()
		.map_err(|e| format!("Failed to get app data directory: {e}"))?
		.join("graph.kuzu");
	
	let db_ref: &'static Database = Box::leak(Box::new(
		Database::new(&graph_path, SystemConfig::default())
			.map_err(|e| format!("Failed to initialize Kuzu database: {e}"))?,
	));
	
	let conn = Connection::new(db_ref)
		.map_err(|e| format!("Failed to create Kuzu connection: {e}"))?;
	
	init_schema(&conn)?;
	let conn_mutex = Mutex::new(conn);
	tauri::async_runtime::block_on(sync_full(&conn_mutex, sqlite))?;
	let conn = conn_mutex
		.into_inner()
		.map_err(|_| "Failed to retrieve initialized Kuzu connection".to_string())?;
	
	Ok(conn)
}

pub fn init_schema(conn: &Connection<'_>) -> Result<(), String> {
	run_ddl_ignoring_exists(conn, CREATE_NOTE_TABLE)?;
	run_ddl_ignoring_exists(conn, CREATE_REL_TABLE)?;
	Ok(())
}

pub fn validate_read_only_query(cypher: &str) -> Result<(), String> {
	let uppercase = cypher.to_ascii_uppercase();
	let tokens = uppercase.split(|c: char| !c.is_ascii_alphanumeric() && c != '_');
	for token in tokens {
		if BLOCKED_WRITE_KEYWORDS.contains(&token) {
			return Err(format!(
				"Write operations are blocked for graph queries. Found blocked keyword: {token}."
			));
		}
	}
	Ok(())
}

pub fn execute_graph_query_inner(conn: &Connection<'_>, cypher: &str) -> Result<JsonValue, String> {
	validate_read_only_query(cypher)?;
	let mut result = conn.query(cypher).map_err(|e| e.to_string())?;
	let column_names = result.get_column_names();
	let rows = result
		.by_ref()
		.map(|row| row_to_json_object(row, &column_names))
		.collect::<Vec<_>>();
	Ok(JsonValue::Array(rows.into_iter().map(JsonValue::Object).collect()))
}

pub async fn sync_note_upsert(
	conn_mutex: &Mutex<ManagedKuzuConnection>,
	sqlite: &SqliteConnection,
	note_id: &str,
) -> Result<(), String> {
	let note = sqlite
		.get_note_projection(note_id)
		.await
		.map_err(|e| format!("Failed to read SQLite note for Kuzu upsert: {e}"))?;
	
	let Some((id, title, tags)) = note else {
		let conn = lock_managed_connection(conn_mutex)?;
		return sync_note_delete(&conn, note_id);
	};
	
	let tags_literal = string_array_literal(&tags);
	let query = format!(
		"MERGE (n:Note {{id: '{id}'}}) SET n.title = '{title}', n.tags = {tags_literal};",
		id = escape_cypher_string(&id),
		title = escape_cypher_string(&title),
	);
	let conn = lock_managed_connection(conn_mutex)?;
	conn.query(&query)
		.map_err(|e| format!("Failed to upsert Note projection in Kuzu: {e}"))?;
	Ok(())
}

pub fn sync_note_delete(conn: &Connection<'_>, note_id: &str) -> Result<(), String> {
	let query = format!(
		"MATCH (n:Note {{id: '{id}'}}) DETACH DELETE n;",
		id = escape_cypher_string(note_id)
	);
	conn.query(&query)
		.map_err(|e| format!("Failed to delete Note projection in Kuzu: {e}"))?;
	Ok(())
}

pub fn sync_link_create(conn: &Connection<'_>, from_id: &str, to_id: &str) -> Result<(), String> {
	let query = format!(
		"MATCH (f:Note {{id: '{from_id}'}}), (t:Note {{id: '{to_id}'}}) MERGE (f)-[:Relation]->(t);",
		from_id = escape_cypher_string(from_id),
		to_id = escape_cypher_string(to_id),
	);
	conn.query(&query)
		.map_err(|e| format!("Failed to create Relation projection in Kuzu: {e}"))?;
	Ok(())
}

pub fn sync_link_delete(conn: &Connection<'_>, from_id: &str, to_id: &str) -> Result<(), String> {
	let query = format!(
		"MATCH (f:Note {{id: '{from_id}'}})-[r:Relation]->(t:Note {{id: '{to_id}'}}) DELETE r;",
		from_id = escape_cypher_string(from_id),
		to_id = escape_cypher_string(to_id),
	);
	conn.query(&query)
		.map_err(|e| format!("Failed to delete Relation projection in Kuzu: {e}"))?;
	Ok(())
}

pub async fn sync_full(
	conn_mutex: &Mutex<ManagedKuzuConnection>,
	sqlite: &SqliteConnection,
) -> Result<(), String> {
	let notes = sqlite
		.get_note_projection_rows()
		.await
		.map_err(|e| format!("Failed to load SQLite notes for Kuzu full sync: {e}"))?;
	let links = sqlite
		.get_all_links()
		.await
		.map_err(|e| format!("Failed to load SQLite links for Kuzu full sync: {e}"))?;
	
	let conn = lock_managed_connection(conn_mutex)?;
	conn.query("DROP TABLE IF EXISTS Relation;")
		.map_err(|e| format!("Failed to drop Kuzu Relation table: {e}"))?;
	conn.query("DROP TABLE IF EXISTS Note;")
		.map_err(|e| format!("Failed to drop Kuzu Note table: {e}"))?;
	init_schema(&conn)?;
	
	for (id, title, tags) in notes {
		let tags_literal = string_array_literal(&tags);
		let query = format!(
			"CREATE (n:Note {{id: '{id}', title: '{title}', tags: {tags_literal}}});",
			id = escape_cypher_string(&id),
			title = escape_cypher_string(&title),
		);
		conn.query(&query)
			.map_err(|e| format!("Failed to insert Note during Kuzu full sync: {e}"))?;
	}
	
	for (from_id, to_id) in links {
		sync_link_create(&conn, &from_id, &to_id)?;
	}
	
	Ok(())
}

pub fn lock_connection<'a>(
	state: &'a tauri::State<'_, Mutex<ManagedKuzuConnection>>,
) -> Result<std::sync::MutexGuard<'a, ManagedKuzuConnection>, String> {
	lock_managed_connection(state.inner())
}

fn run_ddl_ignoring_exists(conn: &Connection<'_>, ddl: &str) -> Result<(), String> {
	match conn.query(ddl) {
		Ok(_) => Ok(()),
		Err(err) => {
			let msg = err.to_string();
			if msg.to_ascii_lowercase().contains("already exists") {
				Ok(())
			} else {
				Err(msg)
			}
		}
	}
}

fn lock_managed_connection(
	conn_mutex: &Mutex<ManagedKuzuConnection>,
) -> Result<MutexGuard<'_, ManagedKuzuConnection>, String> {
	conn_mutex
		.lock()
		.map_err(|_| "Failed to lock Kuzu connection".to_string())
}

fn row_to_json_object(row: Vec<kuzu::Value>, column_names: &[String]) -> Map<String, JsonValue> {
	let mut object = Map::new();
	for (idx, cell) in row.into_iter().enumerate() {
		let key = column_names
			.get(idx)
			.cloned()
			.unwrap_or_else(|| format!("col_{idx}"));
		object.insert(key, kuzu_value_to_json(cell));
	}
	object
}

fn kuzu_value_to_json(value: kuzu::Value) -> JsonValue {
	// Kuzu Value has a Display impl that emits valid scalar/string/list textual values.
	let raw = value.to_string();
	if raw.eq_ignore_ascii_case("null") || raw.is_empty() {
		return JsonValue::Null;
	}
	if raw.eq_ignore_ascii_case("true") {
		return JsonValue::Bool(true);
	}
	if raw.eq_ignore_ascii_case("false") {
		return JsonValue::Bool(false);
	}
	if let Ok(parsed_i64) = raw.parse::<i64>() {
		return JsonValue::Number(parsed_i64.into());
	}
	if let Ok(parsed_f64) = raw.parse::<f64>() {
		if let Some(num) = serde_json::Number::from_f64(parsed_f64) {
			return JsonValue::Number(num);
		}
	}
	JsonValue::String(raw)
}

fn escape_cypher_string(value: &str) -> String {
	value.replace('\\', "\\\\").replace('\'', "\\'")
}

fn string_array_literal(values: &[String]) -> String {
	let escaped = values
		.iter()
		.map(|tag| format!("'{}'", escape_cypher_string(tag)))
		.collect::<Vec<_>>();
	format!("[{}]", escaped.join(", "))
}

pub fn title_from_note_id(note_id: &str) -> String {
	Path::new(note_id)
		.file_name()
		.unwrap_or_default()
		.to_string_lossy()
		.trim_end_matches(".md")
		.to_string()
}
