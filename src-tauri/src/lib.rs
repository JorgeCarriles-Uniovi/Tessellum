pub mod commands;
mod db;
pub mod models;
mod utils;
mod indexer;

use std::fs;

use db::Database;
use tauri::Manager;

pub use models::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(models::AppState::default())
        .setup(|app| {
            // A. Access the state we just registered
            let app_state = app.state::<models::AppState>();

            // B. Resolve the path
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            // C. Ensure the directory actually exists on disk
            if !app_dir.exists() {
                fs::create_dir_all(&app_dir).expect("Failed to create app data directory");
            }

            // D. Construct the full path and URL for SQLite
            let db_path = app_dir.join("index.db");
            let db_url = db_path.to_string_lossy().to_string();
            
            // E. Initialize the DB in a background thread (because .setup is synchronous)
            let db_state_clone = app_state.db.clone();

            tauri::async_runtime::spawn(async move {
                match Database::init(&db_url).await {
                    Ok(db_instance) => {
                        let mut db_guard = db_state_clone.lock().await;
                        *db_guard = Some(db_instance);
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize database: {}", e);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes::create_note,
            commands::notes::trash_item,
            commands::notes::read_file,
            commands::notes::write_file,
            commands::vault::list_files,
            commands::watcher::watch_vault,
            commands::vault::rename_file,
            commands::folders::create_folder,
            commands::links::get_backlinks,
            commands::links::get_outgoing_links,
            commands::indexer::sync_vault,
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
