use serde::{Deserialize, Serialize};

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
/// * `size` - A `u64` representing the size of the file in bytes.
/// * `last_modified` - An `i64` representing the last modified timestamp in Unix epoch time.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileMetadata {
    pub path: String,
    pub filename: String,
    pub is_dir: bool,
    pub size: u64,
    pub last_modified: i64,
}
