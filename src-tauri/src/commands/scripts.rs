use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScriptMeta {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: u64,
}

fn scripts_dir(vault_path: &str) -> PathBuf {
    PathBuf::from(vault_path).join(".tessellum").join("scripts")
}

#[command]
pub async fn list_scripts(vault_path: String) -> Result<Vec<ScriptMeta>, String> {
    let dir = scripts_dir(&vault_path);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut scripts = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext != "js" && ext != "ts" {
            continue;
        }
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("script")
            .to_string();
        let id = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        let modified = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        scripts.push(ScriptMeta {
            id: id.clone(),
            name,
            path: path.to_string_lossy().to_string(),
            size: meta.len(),
            modified,
        });
    }

    scripts.sort_by_key(|s| std::cmp::Reverse(s.modified));
    Ok(scripts)
}

fn validate_script_id(script_id: &str) -> Result<(), String> {
    if script_id.contains("..") || script_id.contains('/') || script_id.contains('\\') {
        return Err("Invalid script id: must not contain path separators or '..'".to_string());
    }
    Ok(())
}

#[command]
pub async fn read_script(vault_path: String, script_id: String) -> Result<String, String> {
    validate_script_id(&script_id)?;
    let path = scripts_dir(&vault_path).join(&script_id);
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[command]
pub async fn write_script(vault_path: String, script_id: String, content: String) -> Result<(), String> {
    validate_script_id(&script_id)?;
    let dir = scripts_dir(&vault_path);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(&script_id);
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[command]
pub async fn delete_script(vault_path: String, script_id: String) -> Result<(), String> {
    validate_script_id(&script_id)?;
    let path = scripts_dir(&vault_path).join(&script_id);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
