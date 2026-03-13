pub mod commands;
mod db;
pub mod error;
mod indexer;
pub mod models;
mod utils;

use db::Database;
use tauri::Manager;

pub use models::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .setup(|app| {
            let app_handle = app.handle();
            let db_url = app_handle
                .path()
                .app_data_dir()
                .expect("failed to get app data directory")
                .join("vault.db")
                .to_str()
                .expect("failed to convert path to string")
                .to_string();
            
            let db_instance = tauri::async_runtime::block_on(async move {
                Database::init(&db_url).await.unwrap_or_else(|e| {
                    log::error!("Failed to initialize database: {}", e);
                    panic!("Failed to initialize database: {}", e);
                })
            });
            
            app.manage(models::AppState::new(db_instance));
            log::info!("Database initialized successfully");
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes::create_note,
            commands::notes::get_or_create_daily_note,
            commands::notes::trash_item,
            commands::notes::read_file,
            commands::notes::write_file,
            commands::notes::search_notes,
            commands::templates::list_templates,
            commands::templates::create_note_from_template,
            commands::vault::list_files,
            commands::vault::list_files_tree,
            commands::watcher::watch_vault,
            commands::vault::rename_file,
            commands::folders::create_folder,
            commands::links::get_backlinks,
            commands::links::get_outgoing_links,
            commands::links::get_all_links,
            commands::links::resolve_wikilink,
            commands::notes::get_all_notes,
            commands::notes::get_all_tags,
            commands::notes::get_file_tags,
            commands::notes::get_all_property_keys,
            commands::indexer::sync_vault,
            commands::graph::get_graph_data,
            commands::vault::set_vault_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;
    
    use commands::extract_wikilinks;
    use models::FileIndex;
    
    #[test]
    fn test_extract_wikilinks() {
        let content = "Check out [[Note 1]] and [[folder/Note 2|Custom Text]]\
        . Also \\[[escaped]].";
        let links = extract_wikilinks(content);
        
        assert_eq!(links.len(), 2);
        assert_eq!(links[0].target, "Note 1");
        assert_eq!(links[0].alias, None);
        assert_eq!(links[1].target, "folder/Note 2");
        assert_eq!(links[1].alias, Some("Custom Text".to_string()));
    }
    
    #[test]
    fn test_file_index_resolution() {
        let dir = tempdir().unwrap();
        let vault_path = dir.path().to_str().unwrap();
        
        // Create test structure
        fs::write(dir.path().join("Note1.md"), "content").unwrap();
        
        let subfolder = dir.path().join("subfolder");
        fs::create_dir(&subfolder).unwrap();
        fs::write(subfolder.join("Note2.md"), "content").unwrap();
        fs::write(subfolder.join("Note1.md"), "duplicate name").unwrap();
        
        let index = FileIndex::build(vault_path).unwrap();
        
        // Test simple resolution
        let resolved = index.resolve(vault_path, "Note2");
        assert!(resolved.is_some());
        assert!(resolved.unwrap().ends_with("Note2.md"));
        
        // Test that Note1 resolves to the one closest to root (shortest path)
        let resolved = index.resolve(vault_path, "Note1");
        assert!(resolved.is_some());
        let path = resolved.unwrap();
        assert!(path.ends_with("Note1.md"));
        assert!(!path.to_string_lossy().contains("subfolder"));
        
        // Test path-based resolution
        let resolved = index.resolve(vault_path, "subfolder/Note1");
        assert!(resolved.is_some());
        assert!(resolved.unwrap().to_string_lossy().contains("subfolder"));
    }
}


