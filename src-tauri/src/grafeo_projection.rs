// Direct Grafeo integration for graph database features

use grafeo::{GrafeoDB, Config};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

// Static database connection shared across the application
static GRAFEO_DB: OnceLock<GrafeoDB> = OnceLock::new();

// Type alias for managed Grafeo connection
pub type ManagedGrafeoConnection = Mutex<()>;

pub fn title_from_note_id(note_id: &str) -> String {
    Path::new(note_id)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .trim_end_matches(".md")
        .to_string()
}

/// Initialize the Grafeo database connection
pub fn init_connection(db_path: PathBuf) -> Result<(), String> {
    if GRAFEO_DB.get().is_some() {
        return Ok(());
    }

    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create Grafeo database directory: {}", e))?;
    }

    // Create configuration for Grafeo database
    let mut config = Config::default();
    config.path = Some(db_path);

    // Create or open the Grafeo database
    let db = GrafeoDB::with_config(config)
        .map_err(|e| format!("Failed to initialize Grafeo database: {}", e))?;

    // Test connection with a simple query
    {
        let session = db.session();
        session.execute("RETURN 1 AS test")
            .map_err(|e| format!("Failed to test Grafeo connection: {}", e))?;
    }

    GRAFEO_DB.set(db)
        .map_err(|_| "Failed to set Grafeo database (already initialized)".to_string())?;

    Ok(())
}

fn get_database() -> Result<&'static GrafeoDB, String> {
    GRAFEO_DB.get()
        .ok_or_else(|| "Grafeo database not initialized".to_string())
}

// Graph sync functions

pub async fn sync_note_upsert(
    _connection: &Mutex<()>,
    sqlite: &crate::db::Database,
    note_id: &str,
) -> Result<(), String> {
    let title = title_from_note_id(note_id);

    // Fetch tags from SQLite
    let tags = sqlite.get_file_tags(note_id)
        .await
        .map_err(|e| format!("Failed to fetch tags from SQLite: {}", e))?;

    let db = get_database()?;
    let session = db.session();

    // Escape single quotes in parameters
    let escaped_id = note_id.replace('\'', "\\'");
    let escaped_title = title.replace('\'', "\\'");

    // Convert tags to GQL array format: ['tag1', 'tag2']
    let tags_array = if tags.is_empty() {
        "[]".to_string()
    } else {
        let escaped_tags: Vec<String> = tags
            .iter()
            .map(|t| format!("'{}'", t.replace('\'', "\\'")))
            .collect();
        format!("[{}]", escaped_tags.join(", "))
    };

    // Create or update note node with tags using MERGE
    let gql = format!(
        "MERGE (n:Note {{id: '{}'}}) SET n.title = '{}', n.tags = {} RETURN n",
        escaped_id, escaped_title, tags_array
    );

    session.execute(&gql)
        .map_err(|e| format!("Failed to upsert note: {}", e))?;

    Ok(())
}

pub fn sync_link_create(_connection: &Mutex<()>, from_id: &str, to_id: &str) -> Result<(), String> {
    let db = get_database()?;
    let session = db.session();

    let escaped_from = from_id.replace('\'', "\\'");
    let escaped_to = to_id.replace('\'', "\\'");

    // Create link between two notes
    let gql = format!(
        "MERGE (from:Note {{id: '{}'}}) \
         MERGE (to:Note {{id: '{}'}}) \
         MERGE (from)-[r:LINKS_TO]->(to) \
         RETURN r",
        escaped_from, escaped_to
    );

    session.execute(&gql)
        .map_err(|e| format!("Failed to create link: {}", e))?;

    Ok(())
}

pub fn sync_link_delete(_connection: &Mutex<()>, from_id: &str, to_id: &str) -> Result<(), String> {
    let db = get_database()?;
    let session = db.session();

    let escaped_from = from_id.replace('\'', "\\'");
    let escaped_to = to_id.replace('\'', "\\'");

    // Delete the specific link between two notes
    let gql = format!(
        "MATCH (from:Note {{id: '{}'}})- [r:LINKS_TO]->(to:Note {{id: '{}'}}) \
         DELETE r",
        escaped_from, escaped_to
    );

    session.execute(&gql)
        .map_err(|e| format!("Failed to delete link: {}", e))?;

    Ok(())
}

pub fn sync_note_delete(_connection: &Mutex<()>, note_id: &str) -> Result<(), String> {
    let db = get_database()?;
    let session = db.session();

    let escaped_id = note_id.replace('\'', "\\'");

    // Delete note node and all its relationships
    let gql = format!(
        "MATCH (n:Note {{id: '{}'}}) DETACH DELETE n",
        escaped_id
    );

    session.execute(&gql)
        .map_err(|e| format!("Failed to delete note: {}", e))?;

    Ok(())
}

pub async fn sync_full(_connection: &Mutex<()>, sqlite: &crate::db::Database) -> Result<(), String> {
    // Fetch all notes from SQLite and sync them to Grafeo
    let indexed_files = sqlite.get_all_indexed_files()
        .await
        .map_err(|e| format!("Failed to fetch notes from SQLite: {}", e))?;

    for (note_path, _modified) in indexed_files {
        let _title = title_from_note_id(&note_path);
        // Best-effort sync - log errors but continue
        if let Err(e) = sync_note_upsert(&Mutex::new(()), sqlite, &note_path).await {
            log::warn!("Failed to sync note {}: {}", note_path, e);
        }
    }

    // Fetch all links from SQLite and sync them to Grafeo
    let links = sqlite.get_all_links()
        .await
        .map_err(|e| format!("Failed to fetch links from SQLite: {}", e))?;

    for (from_path, to_path) in links {
        // Best-effort sync - log errors but continue
        if let Err(e) = sync_link_create(&Mutex::new(()), &from_path, &to_path) {
            log::warn!("Failed to sync link {} -> {}: {}", from_path, to_path, e);
        }
    }

    Ok(())
}

/// Execute a GQL/Cypher query and return results as JSON
pub fn execute_query(query: &str) -> Result<Value, String> {
    let db = get_database()?;
    let session = db.session();

    let result = session.execute(query)
        .map_err(|e| format!("Query execution failed: {}", e))?;

    // Convert Grafeo QueryResult to JSON
    // Frontend expects an array of objects with column names as keys
    let mut json_rows = Vec::new();

    for row in result.rows() {
        let mut json_row = serde_json::Map::new();

        for (i, column_name) in result.columns.iter().enumerate() {
            if let Some(value) = row.get(i) {
                json_row.insert(column_name.clone(), grafeo_value_to_json(value));
            }
        }

        json_rows.push(Value::Object(json_row));
    }

    Ok(Value::Array(json_rows))
}

/// Convert Grafeo Value to serde_json Value
fn grafeo_value_to_json(value: &grafeo::Value) -> Value {
    use grafeo::Value as GV;

    match value {
        GV::Null => Value::Null,
        GV::Bool(b) => Value::Bool(*b),
        GV::Int64(i) => Value::Number((*i).into()),
        GV::Float64(f) => {
            serde_json::Number::from_f64(*f)
                .map(Value::Number)
                .unwrap_or(Value::Null)
        }
        GV::String(s) => Value::String(s.to_string()),
        GV::List(list) => {
            Value::Array(list.iter().map(grafeo_value_to_json).collect())
        }
        GV::Map(map) => {
            let mut json_map = serde_json::Map::new();
            for (k, v) in map.iter() {
                json_map.insert(k.to_string(), grafeo_value_to_json(v));
            }
            Value::Object(json_map)
        }
        GV::Path { nodes, edges } => {
            // Convert path to a JSON object with nodes and edges arrays
            let mut path_map = serde_json::Map::new();
            path_map.insert(
                "nodes".to_string(),
                Value::Array(nodes.iter().map(grafeo_value_to_json).collect()),
            );
            path_map.insert(
                "edges".to_string(),
                Value::Array(edges.iter().map(grafeo_value_to_json).collect()),
            );
            Value::Object(path_map)
        }
        GV::Bytes(bytes) => {
            // Convert bytes to hex string for JSON compatibility
            let hex_string: String = bytes.iter()
                .map(|b| format!("{:02x}", b))
                .collect();
            Value::String(format!("hex:{}", hex_string))
        }
        // For other complex types (timestamps, dates, etc.), convert to string representation
        _ => Value::String(format!("{:?}", value)),
    }
}
