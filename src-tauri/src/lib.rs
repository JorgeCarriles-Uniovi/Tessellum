mod db;

use std::path::{Path};
use std::fs;
use std::fs::metadata;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config, Event, Error};
use tauri::{AppHandle, Emitter, Manager, State};
use db::Database;
use tokio::sync::Mutex;
use std::sync::Arc;
use regex::Regex;

/// Struct representing metadata information for a file or directory.
///
/// This structure contains details about a file or directory, including its path,
/// filename, whether it's a directory, its size, and the last modified timestamp.
///
/// # Fields
///
/// * `path` - A `String` representing the full path of the file or directory.
/// * `filename` - A `String` representing the name of the file or directory.
/// * `is_dir` - A `bool` indicating whether the path is a directory (`true`) or a file (`false`).
/// * `size` - A `u64` representing the size of the file in bytes. For directories, this may be set to 0 or depend on the implementation specifics.
/// * `last_modified` - An `i64` representing the last modified timestamp of the file or directory, typically in Unix epoch time.
///
/// # Traits
///
/// The `FileMetadata` struct implements the following traits:
/// * `Serialize` - Enables the struct to be serialized into formats like JSON.
/// * `Deserialize` - Allows the struct to be deserialized from formats like JSON.
/// * `Clone` - Allows cloning of the struct.
/// * `Debug` - Enables the struct to be formatted using the `{:?}` formatter.
///
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileMetadata {
    path: String,
    filename: String,
    is_dir: bool,
    size: u64,
    last_modified: i64,
}

/// Represents the application state that contains shared resources such as
/// a file watcher and a database connection.
///
/// # Fields
///
/// * `watcher` - A thread-safe, optional wrapper around a `RecommendedWatcher` instance.
///   This watcher is typically used for monitoring file system events.
///   It is wrapped in a `Mutex` to ensure safe concurrent access across threads.
///
/// * `db` - A thread-safe, optional shared reference to a `Database` instance.
///   The `Database` is wrapped in both an `Arc` for shared ownership across threads
///   and a `Mutex` to provide mutable access, ensuring thread-safe operations.
///
/// # Usage
///
/// The `AppState` struct is designed to be utilized in scenarios where
/// multiple parts of an application need shared access to these resources.
/// The use of `Mutex` and `Arc` ensures that these resources can be safely
/// accessed and modified across threads.
///
/// ## Example
/// ```
/// use std::sync::Arc;
/// use tokio::sync::Mutex
/// use notify::RecommendedWatcher;
///
/// let app_state = AppState {
///     watcher: Mutex::new(None),
///     db: Arc::new(Mutex::new(None)),
/// };
/// ```
pub struct AppState {
    watcher: std::sync::Mutex<Option<RecommendedWatcher>>,
    db: Arc<Mutex<Option<Database>>>
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            db: Arc::new(Mutex::new(None)),
            watcher: std::sync::Mutex::new(None)
        }
    }
}

/// Creates a new note file in the specified vault directory with a unique name.
///
/// This function takes in a vault path and a title string to create a new `.md`
/// file in the specified vault directory. If the provided title contains
/// invalid characters or is empty, it is sanitized or defaulted to "Untitled".
/// If a file with the same name already exists, the function appends a numeric suffix
/// to the filename to ensure its uniqueness.
///
/// # Arguments
///
/// * `vault_path` (`String`) - The path to the vault directory where the file will be created.
/// * `title` (`String`) - The desired title for the new note.
///
/// # Returns
///
/// * `Ok(String)` - On success, returns the full file path of the newly created note as a string.
/// * `Err(String)` - On failure, returns an error message as a string.
///
/// # Process
///
/// 1. Sanitizes the `title` string to remove invalid characters.
/// 2. If the sanitized title is empty, defaults to "Untitled".
/// 3. Generates a file name by appending ".md" to the sanitized title.
/// 4. Checks for collisions with existing files in the provided vault directory.
///    If a collision is detected, appends a numeric suffix (e.g., "title (1).md") to
///    the file name and continues checking until a unique name is found.
/// 5. Creates an empty file at the generated file path.
/// 6. Returns the full file path as a string.
///
/// # Examples
///
/// ```
/// let vault_path = String::from("/path/to/vault");
/// let title = String::from("My Note");
///
/// match create_note(vault_path, title) {
///     Ok(file_path) => println!("Note created: {}", file_path),
///     Err(err_message) => eprintln!("Error: {}", err_message),
/// }
/// ```
///
/// # Errors
///
/// The function will return an error in the form of a string if:
/// - The file system encounters an issue while trying to create the new file.
///   This could occur due to insufficient permissions, an invalid directory path,
///   or other file system-related issues.
///
/// # Notes
///
/// * The `sanitize_string` function is assumed to remove or replace invalid characters
///   in the title to ensure a valid file name.
/// * The `to_string_lossy()` method is used to handle any potential encoding issues
///   when converting the file path to a string.
#[tauri::command]
fn create_note(vault_path: String, title: String) -> Result<String, String> {
    
    // Sanitize title for avoiding invalid characters
    let sanitized_title = sanitize_string(title);
    let sanitized_title = {
        if sanitized_title.trim().is_empty()
            { String::from("Untitled") }
        else
            { sanitized_title }
    };
    
    // Create a file path
    let mut filename = format!("{}.md", sanitized_title);
    let mut file_path = Path::new(&vault_path).join(filename);
    let mut collision_index = 1;
    
    // Check for collisions in the filenames
    while file_path.exists() {
        filename = format!("{} ({}).md", sanitized_title, collision_index);
        file_path = Path::new(&vault_path).join(filename);
        collision_index += 1;
    };
    
    // Create an empty file
    fs::write(&file_path, String::new()).map_err(|e| e.to_string())?;
    
    // to_string_lossy() is used to avoid encoding issues
    
    Ok(file_path.to_string_lossy().to_string())

}

/// Moves a note file to a trash directory within the specified vault directory.
///
/// This function is useful for "soft-deleting" notes by moving them to a `.trash`
/// subdirectory within a vault, while ensuring that the filenames are unique
/// using a timestamp. If the `.trash` directory does not exist, it will create one.
///
/// # Arguments
///
/// * `note_path` - A `String` representing the path to the note that should be trashed.
/// * `vault_path` - A `String` representing the path to the vault directory where the
///                  `.trash` folder will be created or updated.
///
/// # Returns
///
/// * `Ok(())` - If the note was successfully moved to the trash directory.
/// * `Err(String)` - If an error occurred during the process, such as an invalid path or
///                   failure to move the file.
///
/// # Errors
///
/// This function will return an error if:
/// - The `note_path` is invalid (e.g., if it does not point to a valid filename).
/// - Creating the `.trash` directory fails.
/// - Moving the file to the `.trash` directory fails.
///
/// # Implementation Details
///
/// - The function ensures that the `note_path` resolves to a valid filename.
/// - If a file with the same name already exists in the trash folder, a unique
///   filename is generated using the current UNIX timestamp.
/// - The `.trash` directory is always created under the given `vault_path` if it does
///   not already exist.
///
/// # Example
///
/// ```rust
/// use tauri::command;
///
/// #[command]
/// fn example_trash_note() -> Result<(), String> {
///     let note_path = String::from("/path/to/note.txt");
///     let vault_path = String::from("/path/to/vault");
///     trash_note(note_path, vault_path)
/// }
/// ```
///
/// In this example:
/// - If the note `/path/to/note.txt` exists, it will be moved to `/path/to/vault/.trash`.
/// - The resulting filename in the trash folder will include the note's parent
///   directory name and a timestamp to ensure uniqueness.
///
/// # Dependencies
///
/// - The function uses the `std::fs` module to handle file system operations.
/// - The `std::path::Path` module is used for path manipulations.
/// - The `std::time::SystemTime` and `UNIX_EPOCH` are used to generate timestamps.
///
/// # Notes
///
/// - The `note_path` and `vault_path` should be absolute paths to avoid any unexpected errors.
/// - Ensure the process running the function has proper permissions to create directories, delete,
///   and move files.
#[tauri::command]
fn trash_note(note_path: String, vault_path: String) -> Result<(), String> {
    // Get the trash directory or create it if it doesn't exist
    let trash_path = Path::new(&vault_path).join(".trash");
    if !trash_path.exists() {
        fs::create_dir(&trash_path).map_err(|e| format!("Failed to create \
        trash directory: {}", e))?;
    }
    
    // Get note filename
    let note_to_trash = Path::new(&note_path);
    let filename = note_to_trash.file_name().ok_or("Invalid path")?;
    
    // Create the destination path
    let mut dest = trash_path.join(filename);
    
    // Get the timestamp to ensure uniqueness
    let timestamp = SystemTime::now().
        duration_since(UNIX_EPOCH).
        unwrap().
        as_millis();
    let filename_as_str = filename.to_string_lossy();
    let filename_as_str = filename_as_str.trim_end_matches(".md");
    
    // Get the parent directory of the note for clarity
    let parent_directory = note_to_trash.parent().unwrap().file_name().unwrap()
        .to_string_lossy();
    let trash_filename = format!("{} ({}) {}.md", filename_as_str,
        parent_directory, timestamp);
    
    // Get the final destination path with the new filename
    dest = trash_path.join(trash_filename);
    
    // Rename the file and move to destination
    fs::rename(note_to_trash, dest).map_err(|e| e.to_string())
    
}

/// Reads the contents of a file at the given path and returns it as a `String`.
///
/// This function is a Tauri command, meaning it can be invoked from the frontend of a Tauri app.
///
/// # Arguments
///
/// * `path` - A `String` representing the path to the file that should be read.
///
/// # Returns
///
/// * `Ok(String)` - If successful, this contains the contents of the file as a `String`.
/// * `Err(String)` - If an error occurs, this
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Writes the specified content to a file at the given path.
///
/// This function attempts to write the content to the file specified by the
/// `path`. If the operation is successful, it returns `Ok(())`. If an error
/// occurs during the file write, it returns an `Err` containing a string
/// representation of the error.
///
/// # Arguments
///
/// * `path` - A `String` representing the path to the file where the content
///            should be written.
/// * `content` - A `String` containing the data to be written to the file.
///
/// # Returns
///
/// * `Ok(())` on successful file write.
/// * `Err(String)` if an error occurs, where the string contains the error
///   message.
///
/// # Errors
///
/// This function will return an error in the following cases:
/// - The file path specified is invalid or inaccessible.
/// - There are not enough permissions to write to the file.
/// - Other I/O issues, such as running out of disk space.
///
/// # Examples
///
/// ```rust
/// use your_module::write_file;
///
/// #[tauri::command]
/// fn example() {
///     let result = write_file("example.txt".to_string(), "Hello, world!".to_string());
///     match result {
///         Ok(_) => println!("File written successfully"),
///         Err(err) => println!("Failed to write file: {}", err),
///     }
/// }
/// ```
#[tauri::command]
async fn write_file(
    state: State<'_, AppState>,
    path: String,
    content: String
    ) -> Result<(), String> {
    tokio::fs::write(&path, &content).await.map_err(|e| e.to_string())?;
    
    let db_guard = state.db.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
        let size = metadata.len();
        let modified = metadata.modified()
            .unwrap_or(SystemTime::now())
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        
        let links = extract_wikilinks(&content);
        
        db.index_file(&path, modified, size, &links)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

/**
 * Lists all files and directories within the specified vault path and retrieves their metadata.
 *
 * # Arguments
 *
 * * `vault_path` - A `String` specifying the path of the directory to scan for files and subdirectories.
 *
 * # Returns
 *
 * This function returns a `Result`:
 * - `Ok(Vec<FileMetadata>)` containing a vector of `FileMetadata` structs for each valid file and directory found.
 * - `Err(String)` containing an error message if the vault path does not exist or processing faced issues.
 *
 * # Behavior
 *
 * 1. Checks if the provided `vault_path` exists. If it does not, an error is returned.
 * 2. Iterates through all entries in the specified directory using the `WalkDir` crate, ignoring hidden files and directories.
 * 3. For every valid entry:
 *     - Retrieves metadata (e.g., size, modification time) of the file or directory.
 *     - Constructs and stores a `FileMetadata` struct containing:
 *         - Full path as a string
 *         - File name
 *         - Whether the entry is a directory
 *         - File size in bytes
 *         - Last modified time since the UNIX epoch in milliseconds
 * 4. Returns the list of valid file metadata wrapped in an `Ok` variant.
 *
 * # Errors
 *
 * * If the `vault_path` does not exist, returns an `Err` with the message `"Vault path does not exist"`.
 * * Hidden files and directories (those starting with `.`) are ignored and not returned in the result.
 *
 * # Example
 *
 * ```rust
 * #[tauri::command]
 * fn main() {
 *     let vault_path = String::from("/path/to/vault");
 *     match list_files(vault_path) {
 *         Ok(files) => {
 *             for file in files {
 *                 println!("File: {}, Size: {} bytes", file.filename, file.size);
 *             }
 *         },
 *         Err(e) => println!("Error: {}", e),
 *     }
 * }
 * ```
 *
 * Make sure to properly handle the potential `Err` variant when calling this function.
 *
 * # Dependencies
 *
 * - This function uses the `WalkDir` crate for recursively iterating through directories.
 * - It also uses the Rust standard library modules `std::fs`, `std::path::Path`, and `std::time::UNIX_EPOCH`.
 *
 * # Notes
 *
 * * Paths to hidden files or directories starting with a `.` are ignored.
 * * This implementation does not handle symbolic links specifically, and behavior with such files may vary.
 */
#[tauri::command]
fn list_files(vault_path: String) -> Result<Vec<FileMetadata>, String> {
    let mut files = Vec::new();
    
    // Check if path exists
    if !Path::new(&vault_path).exists() {
        return Err(String::from("Vault path does not exist"));
    }
    
    // For each entry in the vault directory that does not give an error, add it to the list
    for entry in WalkDir::new(&vault_path).into_iter().filter_map(|e| e.ok()) {
        // Get the file path
        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();
        
        // Ignore hidden files/dirs
        if path_str.contains(".git") || path_str.contains(".trash") {
            continue;
        }
        
        // If able to get metadata, add it to the list
        if let Ok(metadata) = metadata(path) {
            // Get the last modified time in milliseconds
            let modified_time = metadata
                .modified()
                .unwrap_or(UNIX_EPOCH)
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;
            
            // Push the file metadata to the list
            files.push(FileMetadata {
                path: path_str,
                filename: path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                is_dir: metadata.is_dir(),
                size: metadata.len(),
                last_modified: modified_time,
            });
        }
    }
    
    Ok(files)
    
}

/// Watches a directory and emits an event to the frontend whenever a file within the directory changes.
///
/// This function initializes a file system watcher for the specified directory (`vault_path`) and listens for changes
/// such as file creation, modification, or deletion. Upon detecting a change, the function emits a `file-changed`
/// event to the frontend.
///
/// # Arguments
///
/// * `vault_path` - The path to the directory that should be watched.
/// * `handle` - A handle to the Tauri application that enables communication with the frontend.
/// * `state` - A shared application state containing the watcher that allows for thread-safe management
///   of the watcher instance.
///
/// # Returns
///
/// * `Ok(())` - If the watcher is successfully initialized and begins monitoring the directory.
/// * `Err(String)` - If an error occurs during watcher creation, lock acquisition, or directory monitoring.
///
/// # Behavior
///
/// - The function locks the `state.watcher` to obtain access to the shared watcher instance. Any failure to acquire
///   the lock results in an error.
/// - Creates a new instance of `RecommendedWatcher` with a callback that emits the `file-changed` event to the
///   frontend upon detecting changes in the directory.
/// - Sets up the watcher to monitor the specified directory path recursively, meaning it will also monitor
///   subdirectories for changes.
/// - Updates the shared watcher instance with the new watcher to ensure proper management and avoid resource
///   conflicts.
///
/// # Errors
///
/// This function can return an error in the following scenarios:
/// - If acquiring the lock on the `state.watcher` fails.
/// - If initializing the `RecommendedWatcher` fails.
/// - If watching the specified path with the watcher fails.
///
/// # Example Usage
///
/// ```rust
/// #[tauri::command]
/// fn example_command(handle: AppHandle, state: State<AppState>) -> Result<(), String> {
///     let vault_path = "/path/to/watched/directory".to_string();
///     watch_vault(vault_path, handle, state)
/// }
/// ```
///
/// # Notes
///
/// - The `file-changed` event sent to the frontend should be handled appropriately in your frontend code to perform
///   any necessary updates or actions.
/// - Ensure that `vault_path` is a valid directory path that exists before invoking this function.
///
/// # Dependencies
///
/// This function depends on the following external crates:
/// - `tauri` for app command and state handling.
/// - `notify` for file system event watching.
#[tauri::command]
fn watch_vault(vault_path: String, handle: AppHandle, state: State<'_,
    AppState>) -> Result<(), String>{
    
    // Initialize the watcher
    let mut watcher_guard = state
        .watcher
        .lock()
        .map_err(|e| e.to_string())?;
    
    if watcher_guard.is_some() {
        return Ok(())
    }
    
    let app_handle_clone = handle.clone();
    let notify_config = Config::default();
    
    let mut watcher = RecommendedWatcher::new(move |res: Result<Event, Error>| {
        match res {
            Ok(res) => {
                // Emit event to frontend
                // We serialize the event as a struct or just pass raw data
                // if needed
                // For simplicity, we just emit "file-changed"
                let _ = app_handle_clone.emit("file-changed", ());
            }
            
            Err(e) => println!("watch error: {:?}", e)
        }
        
    }, notify_config,
    ).map_err(|e| e.to_string())?;
    
    watcher
        .watch(Path::new(&vault_path), RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    
    *watcher_guard = Some(watcher);
    
    Ok(())
    
}

/// Sanitizes a given string by filtering out any characters that are not alphanumeric
/// or one of the following allowed special characters: space (' '), hyphen ('-'), or underscore ('_').
///
/// # Parameters
/// - `s`: A `String` input containing the text to be sanitized.
///
/// # Returns
/// A new `String` containing only the allowed characters from the input.
///
/// # Examples
/// ```
/// let input = String::from("Hello, World! #2023");
/// let sanitized = sanitize_string(input);
/// assert_eq!(sanitized, "Hello World-2023");
/// ```
fn sanitize_string(s: String) -> String {
    let sanitized: String = s.chars()
        .filter(|c| {
            c.is_alphanumeric()
                || *c == ' '
                || *c == '-'
                || *c == '_'
                || *c == '('
                || *c == ')'
                || *c == '.'
        })
        .collect();
    sanitized.trim_end_matches(|c| c == '.' || c == ' ').to_string()
}

/// Extracts all wikilinks from the given input string.
///
/// Wikilinks are denoted by the pattern `[[...]]`, where "..." represents
/// the content of the link. This function uses a regular expression to find
/// all occurrences of these patterns and extracts their inner content.
///
/// # Arguments
///
/// * `content` - A string slice that contains the text from which wikilinks
///   will be extracted. The input can contain any text, and the function will
///   identify and extract wikilink patterns.
///
/// # Returns
///
/// A `Vec<String>` containing all extracted string values inside the `[[...]]`
/// wikilink patterns. If no wikilinks are found, an empty vector is returned.
///
/// # Examples
///
/// ```
/// let content = "This is a [[wikilink]] in a sentence. Here's another [[link]].";
/// let links = extract_wikilinks(content);
/// assert_eq!(links, vec!["wikilink".to_string(), "link".to_string()]);
/// ```
///
/// # Panics
///
/// This function will panic if the regex definition is invalid. However, the
/// regex string used in this function is predefined and tested, so this is
/// unlikely to occur under normal conditions.
fn extract_wikilinks(content: &str) -> Vec<String> {
    let reg = Regex::new(r"(\\)?\[\[(.*?)\]\]").unwrap();
    reg.captures_iter(content)
        .filter_map(|c| {
            // If there is a backslash before `[[`, this was an escaped literal and not a wikilink.
            if c.get(1).is_some() {
                None
            } else {
                Some(c[2].to_string())
            }
        })
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .setup(|app| {
            // A. Access the state we just registered
            let app_state = app.state::<AppState>();
            
            // B. Resolve the path
            let app_dir = app.path().app_data_dir()
                .expect("Failed to resolve app data directory");
            
            // C. Ensure the directory actually exists on disk
            if !app_dir.exists() {
                fs::create_dir_all(&app_dir)
                    .expect("Failed to create app data directory");
            }
            
            // D. Construct the full path and URL for SQLite
            let db_path = app_dir.join("index.db");
            // Windows paths need special handling if they contain spaces, but usually this works:
            let db_url = db_path.to_string_lossy().to_string();
            
            
            // E. Initialize the DB in a background thread (because .setup is synchronous)
            // We clone the DB Arc pointer so we can move it into the thread
            let db_state_clone = app_state.db.clone();
            
            tauri::async_runtime::spawn(async move {
                // Call your Database::init function
                match Database::init(&db_url).await {
                    Ok(db_instance) => {
                        // Lock the Mutex and save the connection
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
            create_note,
            trash_note,
            read_file,
            write_file,
            list_files,
            watch_vault
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    
    fn get_test_state() -> State<'static, AppState> {
        // In a real scenario, use tauri::test or proper mocking
        // Here we just leak memory to get a static reference for the test signature
        let state = Box::new(AppState::default());
        let static_ref = Box::leak(state);
        unsafe { std::mem::transmute(static_ref) }
    }
    
    #[tokio::test]
    async fn test_save_and_get_file_content() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test_note.md");
        let path_str = file_path.to_str().unwrap().to_string();
        let content = "# Hello World";
        let state = get_test_state();
        
        // Test save
        let save_result = write_file(state.clone(), path_str.clone(), content
            .to_string()).await;
        assert!(save_result.is_ok());
        assert!(file_path.exists());
        
        // Test get
        let get_result = read_file(path_str.clone());
        assert!(
            get_result.is_ok(),
            "Failed to get content: {:?}",
            get_result.err()
        );
        assert_eq!(get_result.unwrap(), content);
        
        // Test overwrite
        let new_content = "# New Content";
        let save_result = write_file(state.clone(), path_str.clone(),
            new_content.to_string()).await;
        assert!(save_result.is_ok());
        
        let get_result = read_file(path_str);
        assert_eq!(get_result.unwrap(), new_content);
    }
    
    #[test]
    fn test_list_files() {
        let dir = tempdir().unwrap();
        let vault_path = dir.path().to_str().unwrap().to_string();
        
        // Create some files
        let file1 = dir.path().join("note1.md");
        let file2 = dir.path().join("note2.txt");
        let hidden = dir.path().join(".hidden");
        let git_dir = dir.path().join(".git");
        let trash_dir = dir.path().join(".trash");
        
        fs::write(&file1, "content").unwrap();
        fs::write(&file2, "content").unwrap();
        fs::write(&hidden, "content").unwrap();
        fs::create_dir(&git_dir).unwrap();
        fs::create_dir(&trash_dir).unwrap();
        
        let result = list_files(vault_path);
        assert!(result.is_ok());
        
        let files = result.unwrap();
        let names: Vec<String> = files.iter().map(|f| f.filename.clone())
            .collect();
        
        // Should contain note1.md and note2.txt
        assert!(names.contains(&"note1.md".to_string()));
        assert!(names.contains(&"note2.txt".to_string()));
        
        // Should contain .hidden because we only filter .git and .trash specifically in list_files logic?
        // Let's check logic: if path_str.contains(".git") || path_str.contains(".trash")
        // It does NOT filter general dotfiles, only .git and .trash.
        assert!(names.contains(&".hidden".to_string()));
        
        // Should NOT contain .git or .trash
        // Note: WalkDir returns directories too.
        // ".git" dir should be filtered.
        assert!(!names.iter().any(|n| n == ".git"));
        assert!(!names.iter().any(|n| n == ".trash"));
    }
    
    #[test]
    fn test_create_note() {
        let dir = tempdir().unwrap();
        let vault_path = dir.path().to_str().unwrap().to_string();
        
        // 1. Basic creation
        let path1 = create_note(vault_path.clone(), "My Note".to_string()).unwrap();
        assert!(Path::new(&path1).exists());
        assert!(path1.ends_with("My Note.md"));
        
        // 2. Collision handling -> should append (1)
        let path2 = create_note(vault_path.clone(), "My Note".to_string()).unwrap();
        assert!(Path::new(&path2).exists());
        assert!(path2.ends_with("My Note (1).md"));
        
        // 3. Collision handling -> should append (2)
        let path3 = create_note(vault_path.clone(), "My Note".to_string()).unwrap();
        assert!(Path::new(&path3).exists());
        assert!(path3.ends_with("My Note (2).md"));
        
        // 4. Empty title -> check logic
        // "Untitled"
        let path4 = create_note(vault_path.clone(), "   ".to_string()).unwrap();
        println!("path4: {}", path4);
        assert!(path4.contains("Untitled"));
        
        // 5. Sanitization
        // "Note: With / Invalid * Chars?" -> "Note With  Invalid  Chars" (strips non-alphanumeric except space, -, _)
        let path5 = create_note(vault_path, "Note/With*Chars".to_string()).unwrap();
        // "Note" "With" "Chars" -> "NoteWithChars"
        assert!(path5.ends_with("NoteWithChars.md"));
    }
    
    #[test]
    fn test_trash_note() {
        let dir = tempdir().unwrap();
        let vault_path = dir.path().to_str().unwrap().to_string();
        let trash_path = dir.path().join(".trash");
        
        // Create a subfolder to test parent name
        let subfolder = dir.path().join("subfolder");
        fs::create_dir(&subfolder).unwrap();
        
        // Create a file to delete inside subfolder
        let file_path = subfolder.join("todelete.md");
        fs::write(&file_path, "content").unwrap();
        let file_path_str = file_path.to_str().unwrap().to_string();
        
        // Delete it
        let result = trash_note(file_path_str.clone(), vault_path.clone());
        assert!(result.is_ok());
        
        // File should be gone from original spot
        assert!(!file_path.exists());
        
        // Trash should exist
        assert!(trash_path.exists());
        assert!(trash_path.is_dir());
        
        // Verify trash content naming
        let trash_files: Vec<_> = fs::read_dir(&trash_path).unwrap().collect();
        assert_eq!(trash_files.len(), 1);
        
        let trash_entry = trash_files[0].as_ref().unwrap();
        let trash_filename = trash_entry.file_name().to_string_lossy().to_string();
        
        // Expected format: todelete (subfolder) <timestamp>.md
        assert!(trash_filename.starts_with("todelete (subfolder) "));
        assert!(trash_filename.ends_with(".md"));
    }
}
