use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};
use crate::error::TessellumError;

const RECOVERY_DIR: &str = ".tessellum/recovery";
const RECOVERY_EXT: &str = ".recovery.md";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecoveryFileInfo {
    /// Original note path relative to vault root
    pub original_path: String,
    /// Filename of the recovery file in the recovery directory
    pub recovery_filename: String,
    /// Millisecond timestamp when the recovery file was last written
    pub saved_at_ms: i64,
}

fn recovery_dir(vault_path: &str) -> PathBuf {
    Path::new(vault_path).join(RECOVERY_DIR)
}

/// Encode a note path to a safe recovery filename by replacing `/` with `__`.
fn encode_note_path(note_path: &str, vault_path: &str) -> String {
    let normalized_vault = vault_path.trim_end_matches('/');
    let normalized_note = note_path.trim_start_matches('/');
    let relative = normalized_note
        .strip_prefix(&format!("{}/", normalized_vault))
        .unwrap_or(normalized_note);
    relative.replace('/', "__")
}

/// Decode a recovery filename back to the relative note path.
fn decode_note_path(filename: &str) -> Option<String> {
    filename
        .strip_suffix(RECOVERY_EXT)
        .map(|stem| stem.replace("__", "/"))
}

/// Write a crash-recovery snapshot for a note.
#[tauri::command]
pub async fn write_recovery_file(
    vault_path: String,
    note_path: String,
    content: String,
) -> Result<(), TessellumError> {
    let dir = recovery_dir(&vault_path);
    fs::create_dir_all(&dir)
        .map_err(|e| TessellumError::Internal(format!("Failed to create recovery dir: {e}")))?;

    let encoded = encode_note_path(&note_path, &vault_path);
    let recovery_path = dir.join(format!("{encoded}{RECOVERY_EXT}"));

    fs::write(&recovery_path, &content)
        .map_err(|e| TessellumError::Internal(format!("Failed to write recovery file '{}': {e}", recovery_path.display())))?;

    Ok(())
}

/// List all recovery files for the given vault.
#[tauri::command]
pub async fn list_recovery_files(
    vault_path: String,
) -> Result<Vec<RecoveryFileInfo>, TessellumError> {
    let dir = recovery_dir(&vault_path);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(&dir)
        .map_err(|e| TessellumError::Internal(format!("Failed to read recovery dir: {e}")))?;

    let mut result = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.ends_with(RECOVERY_EXT) {
            continue;
        }
        let Some(original_path) = decode_note_path(&name) else {
            continue;
        };
        let saved_at_ms = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        result.push(RecoveryFileInfo {
            original_path,
            recovery_filename: name,
            saved_at_ms,
        });
    }

    result.sort_by(|a, b| b.saved_at_ms.cmp(&a.saved_at_ms));
    Ok(result)
}

/// Read the content of a specific recovery file.
#[tauri::command]
pub async fn read_recovery_file(
    vault_path: String,
    recovery_filename: String,
) -> Result<String, TessellumError> {
    let path = recovery_dir(&vault_path).join(&recovery_filename);
    fs::read_to_string(&path)
        .map_err(|e| TessellumError::Internal(format!("Failed to read recovery file '{}': {e}", path.display())))
}

/// Delete a recovery file (after successful restore or user discard).
#[tauri::command]
pub async fn clear_recovery_file(
    vault_path: String,
    recovery_filename: String,
) -> Result<(), TessellumError> {
    let path = recovery_dir(&vault_path).join(&recovery_filename);
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| TessellumError::Internal(format!("Failed to delete recovery file '{}': {e}", path.display())))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_round_trips() {
        let vault = "/home/user/Vault";
        let note = "/home/user/Vault/Projects/2024/Meeting Notes.md";
        let encoded = encode_note_path(note, vault);
        assert_eq!(encoded, "Projects__2024__Meeting Notes.md");
        let decoded = decode_note_path(&format!("{encoded}{RECOVERY_EXT}"));
        assert_eq!(decoded, Some("Projects/2024/Meeting Notes.md".to_string()));
    }

    #[test]
    fn encode_root_level_note() {
        let vault = "/home/user/Vault";
        let note = "/home/user/Vault/Note.md";
        let encoded = encode_note_path(note, vault);
        assert_eq!(encoded, "Note.md");
    }
}
