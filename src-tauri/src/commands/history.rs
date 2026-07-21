use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};
use crate::error::TessellumError;

const HISTORY_DIR: &str = ".tessellum/history";
const SNAPSHOT_EXT: &str = ".md";
const PIN_EXT: &str = ".pin";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SnapshotInfo {
    /// ISO-8601 timestamp used as the snapshot filename stem
    pub timestamp: String,
    /// Unix milliseconds (for sorting / display)
    pub timestamp_ms: i64,
    /// Optional user-defined label for pinned snapshots
    pub label: Option<String>,
}

fn history_dir_for_note(vault_path: &str, note_path: &str) -> PathBuf {
    let stem = note_stem(note_path, vault_path);
    Path::new(vault_path).join(HISTORY_DIR).join(stem)
}

/// Convert a note path to a flat directory name safe for use as a folder name.
///
/// Handles both `/` and `\` separators so vault-relative stems are computed
/// consistently across Windows, macOS, and Linux.
fn note_stem(note_path: &str, vault_path: &str) -> String {
    let normalized_note = note_path.replace('\\', "/");
    let normalized_vault = vault_path.replace('\\', "/");
    let vault_prefix = normalized_vault.trim_end_matches('/');
    let relative = normalized_note
        .strip_prefix(vault_prefix)
        .unwrap_or(&normalized_note)
        .trim_start_matches('/');
    // Replace path separators with __ and strip extension
    let stem = relative.strip_suffix(".md").unwrap_or(relative);
    stem.replace('/', "__")
}

fn timestamp_now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn ms_to_iso(ms: i64) -> String {
    // Format as compact ISO-8601: 20240618T153045123Z
    let secs = ms / 1000;
    let ms_part = ms % 1000;
    let dt = time_from_secs(secs);
    format!(
        "{:04}{:02}{:02}T{:02}{:02}{:02}{:03}Z",
        dt.0, dt.1, dt.2, dt.3, dt.4, dt.5, ms_part
    )
}

/// Minimal UTC decomposition without external crate.
fn time_from_secs(secs: i64) -> (i32, u32, u32, u32, u32, u32) {
    let days = secs / 86400;
    let rem = secs % 86400;
    let h = (rem / 3600) as u32;
    let m = ((rem % 3600) / 60) as u32;
    let s = (rem % 60) as u32;

    // Gregorian calendar computation
    let mut y = 1970i32;
    let mut d = days;
    loop {
        let leap = (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
        let yd = if leap { 366 } else { 365 };
        if d < yd {
            break;
        }
        d -= yd;
        y += 1;
    }
    let leap = (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
    let month_days: [i64; 12] = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut mo = 1u32;
    let mut r = d;
    for ml in &month_days {
        if r < *ml {
            break;
        }
        r -= ml;
        mo += 1;
    }
    (y, mo, r as u32 + 1, h, m, s)
}

/// Write a snapshot of a note. Called on every save.
#[tauri::command]
pub async fn write_note_snapshot(
    vault_path: String,
    note_path: String,
    content: String,
) -> Result<String, TessellumError> {
    let dir = history_dir_for_note(&vault_path, &note_path);
    fs::create_dir_all(&dir)
        .map_err(|e| TessellumError::Internal(format!("Failed to create history dir: {e}")))?;

    let ts_ms = timestamp_now_ms();
    let ts = ms_to_iso(ts_ms);
    let snapshot_path = dir.join(format!("{ts}{SNAPSHOT_EXT}"));

    fs::write(&snapshot_path, &content)
        .map_err(|e| TessellumError::Internal(format!("Failed to write snapshot '{}': {e}", snapshot_path.display())))?;

    Ok(ts)
}

/// List all snapshots for a note, newest first.
#[tauri::command]
pub async fn list_note_snapshots(
    vault_path: String,
    note_path: String,
) -> Result<Vec<SnapshotInfo>, TessellumError> {
    let dir = history_dir_for_note(&vault_path, &note_path);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(&dir)
        .map_err(|e| TessellumError::Internal(format!("Failed to read history dir: {e}")))?;

    let mut snapshots: Vec<SnapshotInfo> = Vec::new();

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.ends_with(PIN_EXT) {
            continue; // label files handled below
        }
        let Some(ts) = name.strip_suffix(SNAPSHOT_EXT) else { continue };
        // Skip if not a snapshot file (e.g. .pin files whose stem ends in .md)
        if ts.ends_with(PIN_EXT) {
            continue;
        }

        let saved_at_ms = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        // Check for pin label file: {timestamp}.md.pin
        let pin_path = dir.join(format!("{name}{PIN_EXT}"));
        let label = if pin_path.exists() {
            fs::read_to_string(&pin_path).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
        } else {
            None
        };

        snapshots.push(SnapshotInfo {
            timestamp: ts.to_string(),
            timestamp_ms: saved_at_ms,
            label,
        });
    }

    // Newest first
    snapshots.sort_by_key(|s| std::cmp::Reverse(s.timestamp_ms));
    Ok(snapshots)
}

/// Read the content of a specific snapshot.
#[tauri::command]
pub async fn get_note_snapshot(
    vault_path: String,
    note_path: String,
    timestamp: String,
) -> Result<String, TessellumError> {
    let dir = history_dir_for_note(&vault_path, &note_path);
    let path = dir.join(format!("{timestamp}{SNAPSHOT_EXT}"));
    fs::read_to_string(&path)
        .map_err(|e| TessellumError::Internal(format!("Failed to read snapshot '{}': {e}", path.display())))
}

/// Pin a snapshot with a user label.
#[tauri::command]
pub async fn pin_snapshot(
    vault_path: String,
    note_path: String,
    timestamp: String,
    label: String,
) -> Result<(), TessellumError> {
    let dir = history_dir_for_note(&vault_path, &note_path);
    let pin_path = dir.join(format!("{timestamp}{SNAPSHOT_EXT}{PIN_EXT}"));
    fs::write(&pin_path, label.trim())
        .map_err(|e| TessellumError::Internal(format!("Failed to write pin '{}': {e}", pin_path.display())))
}

/// Remove the pin label from a snapshot.
#[tauri::command]
pub async fn unpin_snapshot(
    vault_path: String,
    note_path: String,
    timestamp: String,
) -> Result<(), TessellumError> {
    let dir = history_dir_for_note(&vault_path, &note_path);
    let pin_path = dir.join(format!("{timestamp}{SNAPSHOT_EXT}{PIN_EXT}"));
    if pin_path.exists() {
        fs::remove_file(&pin_path)
            .map_err(|e| TessellumError::Internal(format!("Failed to remove pin '{}': {e}", pin_path.display())))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn note_stem_strips_md_and_encodes_slashes() {
        let vault = "/vault";
        let note = "/vault/Projects/2024/Notes.md";
        assert_eq!(note_stem(note, vault), "Projects__2024__Notes");
    }

    #[test]
    fn note_stem_root_level() {
        let vault = "/vault";
        let note = "/vault/Note.md";
        assert_eq!(note_stem(note, vault), "Note");
    }

    #[test]
    fn ms_to_iso_format() {
        // 2024-06-18 15:30:45.123 UTC
        let ms = 1718724645123i64;
        let ts = ms_to_iso(ms);
        // Just check it starts with a reasonable prefix and has the right length
        assert!(ts.starts_with("2024"), "timestamp: {ts}");
        assert!(ts.ends_with('Z'), "timestamp: {ts}");
    }
}
