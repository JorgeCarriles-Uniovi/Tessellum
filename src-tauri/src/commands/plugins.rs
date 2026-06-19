use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstalledPlugin {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub author: String,
    pub homepage: Option<String>,
    pub keywords: Option<Vec<String>>,
    pub permissions: Option<Vec<String>>,
    pub entry: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommunityPlugin {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub author: String,
    pub homepage: Option<String>,
    pub keywords: Option<Vec<String>>,
    pub permissions: Option<Vec<String>>,
    pub entry: String,
}

fn plugins_dir(vault_path: &str) -> PathBuf {
    PathBuf::from(vault_path)
        .join(".tessellum")
        .join("plugins")
}

#[command]
pub async fn list_installed_plugins(vault_path: String) -> Result<Vec<InstalledPlugin>, String> {
    let dir = plugins_dir(&vault_path);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut plugins = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let manifest_path = entry.path().join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }
        let data = fs::read_to_string(&manifest_path).map_err(|e| e.to_string())?;
        if let Ok(plugin) = serde_json::from_str::<InstalledPlugin>(&data) {
            plugins.push(plugin);
        }
    }

    Ok(plugins)
}

#[command]
pub async fn install_plugin(vault_path: String, manifest_url: String) -> Result<InstalledPlugin, String> {
    let client = reqwest::Client::new();

    // Fetch manifest
    let manifest_json = client
        .get(&manifest_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch manifest: {e}"))?
        .text()
        .await
        .map_err(|e| format!("Failed to read manifest response: {e}"))?;

    let plugin: CommunityPlugin =
        serde_json::from_str(&manifest_json).map_err(|e| format!("Invalid manifest JSON: {e}"))?;

    // Validate ID to prevent path traversal
    if plugin.id.contains("..") || plugin.id.contains('/') || plugin.id.contains('\\') {
        return Err("Invalid plugin ID".to_string());
    }

    let plugin_dir = plugins_dir(&vault_path).join(&plugin.id);
    fs::create_dir_all(&plugin_dir).map_err(|e| format!("Failed to create plugin dir: {e}"))?;

    // Derive entry URL relative to manifest URL base
    let entry_url = if plugin.entry.starts_with("http://") || plugin.entry.starts_with("https://") {
        plugin.entry.clone()
    } else {
        // Entry is relative to the manifest URL directory
        let base = manifest_url.rsplit_once('/').map(|(b, _)| b).unwrap_or(&manifest_url);
        format!("{}/{}", base, plugin.entry)
    };

    // Download the entry script
    let entry_code = client
        .get(&entry_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch entry script: {e}"))?
        .text()
        .await
        .map_err(|e| format!("Failed to read entry response: {e}"))?;

    let entry_filename = plugin.entry.rsplit('/').next().unwrap_or("index.js");
    fs::write(plugin_dir.join(entry_filename), &entry_code)
        .map_err(|e| format!("Failed to write entry script: {e}"))?;

    // Write manifest with local entry path
    let installed = InstalledPlugin {
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        version: plugin.version,
        author: plugin.author,
        homepage: plugin.homepage,
        keywords: plugin.keywords,
        permissions: plugin.permissions,
        entry: entry_filename.to_string(),
    };

    let manifest_data =
        serde_json::to_string_pretty(&installed).map_err(|e| format!("Serialisation error: {e}"))?;
    fs::write(plugin_dir.join("manifest.json"), manifest_data)
        .map_err(|e| format!("Failed to write manifest: {e}"))?;

    Ok(installed)
}

#[command]
pub async fn uninstall_plugin(vault_path: String, plugin_id: String) -> Result<(), String> {
    if plugin_id.contains("..") || plugin_id.contains('/') || plugin_id.contains('\\') {
        return Err("Invalid plugin ID".to_string());
    }

    let plugin_dir = plugins_dir(&vault_path).join(&plugin_id);
    if plugin_dir.exists() {
        fs::remove_dir_all(&plugin_dir).map_err(|e| format!("Failed to remove plugin: {e}"))?;
    }
    Ok(())
}

#[command]
pub async fn fetch_community_registry(registry_url: String) -> Result<Vec<CommunityPlugin>, String> {
    let client = reqwest::Client::new();
    let body = client
        .get(&registry_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch registry: {e}"))?
        .text()
        .await
        .map_err(|e| format!("Failed to read registry response: {e}"))?;

    let plugins: Vec<CommunityPlugin> =
        serde_json::from_str(&body).map_err(|e| format!("Invalid registry JSON: {e}"))?;
    Ok(plugins)
}
