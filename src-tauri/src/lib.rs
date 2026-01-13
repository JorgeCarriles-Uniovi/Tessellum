use std::path::{Path};
use std::fs;
use std::fs::metadata;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config, Event, Error};
use tauri::{AppHandle, Emitter, Manager, State};
use std::sync::Mutex;

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

/// Represents the shared state of an application.
///
/// This structure is designed to hold application-wide shared resources.
/// It can be used to maintain state or manage resources that need to
/// be accessed across multiple parts of the application.
///
/// # Fields
/// - `watcher`: A thread-safe `Mutex` wrapping an `Option<RecommendedWatcher>`.
///   This is used for managing a file watcher, which may or may not be active (hence the `Option`).
///   The `Mutex` ensures that access to the watcher is synchronized across
///   multiple threads.
///
/// # Use Case
/// - This struct is ideal for scenarios where a watcher, such as a file or directory monitoring system,
///   is required to track changes asynchronously within a shared state.
/// - The `watcher` field can be `None` if there is no current need for a watcher,
///   or it may hold an active `RecommendedWatcher` instance if monitoring is enabled.
///
/// # Example
/// ```rust
/// use notify::{RecommendedWatcher, RecursiveMode, Watcher};
/// use std::sync::Mutex;
/// use my_crate::AppState;
///
/// let app_state = AppState {
///     watcher: Mutex::new(None),
/// };
///
/// // Later in the application, the watcher can be initialized and used:
/// {
///     let mut watcher_guard = app_state.watcher.lock().unwrap();
///     *watcher_guard = Some(RecommendedWatcher::new(|res| {
///         match res {
///             Ok(event) => println!("Changed: {:?}", event),
///             Err(e) => println!("Watcher error: {:?}", e),
///         }
///     }).unwrap());
/// }
/// ```
pub struct AppState {
    watcher: Mutex<Option<RecommendedWatcher>>
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            watcher: Mutex::new(None)
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
        if sanitized_title.is_empty()
            { String::from("Untitled") }
        else
            { sanitized_title }
    };
    
    // Create a file path
    let mut filename = format!("{}.md", sanitized_title);
    let mut file_path = Path::new(&vault_path).join(filename);
    let mut colision_index = 1;
    
    // Check for collisions in the filenames
    while file_path.exists() {
        filename = format!("{} ({}).md", sanitized_title, colision_index);
        file_path = Path::new(&vault_path).join(filename);
        colision_index += 1;
    };
    
    // Create an empty file
    fs::write(&file_path, String::new()).expect("Unable to create file");
    
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
        fs::create_dir(&trash_path).expect("Unable to create trash directory");
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
    
    // Get the parent directory of the note for clarity
    let parent_directory = note_to_trash.parent().unwrap().file_name().unwrap()
        .to_string_lossy();
    let trash_filename = format!("{} ({}) {}", filename_as_str,
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
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
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
        if path_str.starts_with(".") { continue; }
        
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
        .map_err(|_| "Unable to acquire lock on watcher")?;
    
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
    s.chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
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
