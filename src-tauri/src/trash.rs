use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const TRASH_DIR_NAME: &str = ".trash";
const MILLIS_PER_DAY: u128 = 24 * 60 * 60 * 1000;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct PurgeReport {
	pub deleted: usize,
	pub skipped_invalid_name: usize,
	pub errors: usize,
}

/// Generates a unique trash name using the current naming format:
/// "<stem-or-dirname> (<parent>) <timestamp>[.md]"
pub fn generate_trash_name(path: &Path, timestamp: u128) -> Option<String> {
	let filename = path.file_name()?.to_string_lossy();
	
	let raw_parent = path
		.parent()
		.and_then(|p| p.file_name())
		.map(|n| n.to_string_lossy())
		.unwrap_or_else(|| "root".into());
	
	// Strip a previous trailing " (<something>)" chain to keep names readable.
	let clean_parent = raw_parent.split(" (").next().unwrap_or(&raw_parent);
	
	if path.is_dir() {
		Some(format!("{} ({}) {}", filename, clean_parent, timestamp))
	} else {
		let stem = filename.trim_end_matches(".md");
		Some(format!("{} ({}) {}.md", stem, clean_parent, timestamp))
	}
}

fn split_name_parts(name: &str) -> (&str, Option<&str>) {
	match name.rsplit_once('.') {
		Some((stem, ext)) if !stem.is_empty() => (stem, Some(ext)),
		_ => (name, None),
	}
}

fn with_collision_suffix(name: &str, collision_index: usize) -> String {
	let (stem, extension) = split_name_parts(name);
	match extension {
		Some(ext) => format!("{stem} [{collision_index}].{ext}"),
		None => format!("{stem} [{collision_index}]"),
	}
}

/// Builds a unique destination path inside `.trash`, avoiding name collisions when
/// multiple items resolve to the same trash name.
pub fn generate_unique_trash_path(trash_dir: &Path, source_path: &Path, timestamp: u128) -> Option<PathBuf> {
	let base_name = generate_trash_name(source_path, timestamp)?;
	let mut candidate = trash_dir.join(&base_name);
	let mut collision_index = 1;
	
	while candidate.exists() {
		let next_name = with_collision_suffix(&base_name, collision_index);
		candidate = trash_dir.join(next_name);
		collision_index += 1;
	}
	
	Some(candidate)
}

/// Recursively renames children of a trashed directory with the same timestamp.
pub fn rename_recursively(dir: &Path, timestamp: u128) -> std::io::Result<()> {
	if !dir.is_dir() {
		return Ok(());
	}
	
	let entries: Vec<PathBuf> = fs::read_dir(dir)?
		.filter_map(|e| e.ok().map(|entry| entry.path()))
		.collect();
	
	for path in entries {
		if let Some(new_name) = generate_trash_name(&path, timestamp) {
			let new_path = path.parent().unwrap_or(dir).join(new_name);
			fs::rename(&path, &new_path)?;
			if new_path.is_dir() {
				rename_recursively(&new_path, timestamp)?;
			}
		}
	}
	
	Ok(())
}

/// Extracts the trailing Unix-milliseconds timestamp from a trash item name.
/// Valid examples:
/// - "Note (Folder) 1740681450123.md"
/// - "Folder (Root) 1740681450123"
pub fn parse_trash_timestamp(name: &str) -> Option<u128> {
	let without_ext = name.strip_suffix(".md").unwrap_or(name);
	let (_, timestamp) = without_ext.rsplit_once(' ')?;
	timestamp.parse::<u128>().ok()
}

pub fn purge_expired_trash(vault_path: &str, retention_days: u64) -> PurgeReport {
	let vault = Path::new(vault_path);
	let now_ms = SystemTime::now()
		.duration_since(UNIX_EPOCH)
		.unwrap_or_default()
		.as_millis();
	purge_expired_trash_with_now(vault, retention_days, now_ms)
}

fn purge_expired_trash_with_now(vault_path: &Path, retention_days: u64, now_ms: u128) -> PurgeReport {
	let trash_dir = vault_path.join(TRASH_DIR_NAME);
	if !trash_dir.exists() {
		return PurgeReport::default();
	}
	
	let mut report = PurgeReport::default();
	let retention_ms = retention_days as u128 * MILLIS_PER_DAY;
	
	let entries = match fs::read_dir(&trash_dir) {
		Ok(entries) => entries,
		Err(err) => {
			log::error!("Failed to read trash directory '{}': {}", trash_dir.display(), err);
			report.errors += 1;
			return report;
		}
	};
	
	for entry_result in entries {
		let entry = match entry_result {
			Ok(entry) => entry,
			Err(err) => {
				log::warn!(
                    "Skipping unreadable trash entry in '{}': {}",
                    trash_dir.display(),
                    err
                );
				report.errors += 1;
				continue;
			}
		};
		
		let entry_path = entry.path();
		let entry_name = entry.file_name();
		let Some(entry_name_str) = entry_name.to_str() else {
			report.skipped_invalid_name += 1;
			continue;
		};
		
		let Some(item_timestamp_ms) = parse_trash_timestamp(entry_name_str) else {
			report.skipped_invalid_name += 1;
			continue;
		};
		
		let age_ms = now_ms.saturating_sub(item_timestamp_ms);
		if age_ms <= retention_ms {
			continue;
		}
		
		let delete_result = if entry_path.is_dir() {
			fs::remove_dir_all(&entry_path)
		} else {
			fs::remove_file(&entry_path)
		};
		
		match delete_result {
			Ok(()) => report.deleted += 1,
			Err(err) => {
				report.errors += 1;
				log::warn!(
                    "Failed to delete expired trash entry '{}': {}",
                    entry_path.display(),
                    err
                );
			}
		}
	}
	
	report
}

#[cfg(test)]
mod tests {
	use super::*;
	use std::io::Write;
	use tempfile::tempdir;
	
	fn days_to_ms(days: u128) -> u128 {
		days * MILLIS_PER_DAY
	}
	
	#[test]
	fn parse_timestamp_from_valid_names() {
		let ts = 1_740_681_450_123_u128;
		let file_name = format!("Note (Daily) {}.md", ts);
		let dir_name = format!("Folder (Projects) {}", ts);
		
		assert_eq!(parse_trash_timestamp(&file_name), Some(ts));
		assert_eq!(parse_trash_timestamp(&dir_name), Some(ts));
	}
	
	#[test]
	fn parse_timestamp_invalid_names_are_skipped() {
		assert_eq!(parse_trash_timestamp("no-timestamp.md"), None);
		assert_eq!(parse_trash_timestamp("Bad (Parent) abc.md"), None);
		assert_eq!(parse_trash_timestamp(""), None);
	}
	
	#[test]
	fn generate_unique_trash_path_appends_counter_when_name_exists() {
		let dir = tempdir().unwrap();
		let vault = dir.path();
		let trash = vault.join(".trash");
		fs::create_dir_all(&trash).unwrap();
		
		let source_dir = vault.join("Folder A");
		fs::create_dir_all(&source_dir).unwrap();
		let source_file = source_dir.join("Note.md");
		fs::write(&source_file, "note").unwrap();
		
		let timestamp = 1_740_681_450_123_u128;
		let first_name = generate_trash_name(&source_file, timestamp).unwrap();
		fs::write(trash.join(&first_name), "existing").unwrap();
		
		let unique_path = generate_unique_trash_path(&trash, &source_file, timestamp).unwrap();
		assert_eq!(
			unique_path.file_name().and_then(|name| name.to_str()),
			Some("Note (Folder A) 1740681450123 [1].md")
		);
	}
	
	#[test]
	fn expiration_boundary_is_strictly_greater_than_retention() {
		let dir = tempdir().unwrap();
		let vault = dir.path();
		let trash = vault.join(".trash");
		fs::create_dir_all(&trash).unwrap();
		
		let now_ms = 2_000_000_000_000_u128;
		let exactly_30d = now_ms - days_to_ms(30);
		let older_than_30d = now_ms - days_to_ms(30) - 1;
		
		let keep_name = format!("Keep (Root) {}.md", exactly_30d);
		let delete_name = format!("Delete (Root) {}.md", older_than_30d);
		fs::write(trash.join(&keep_name), "keep").unwrap();
		fs::write(trash.join(&delete_name), "delete").unwrap();
		
		let report = purge_expired_trash_with_now(vault, 30, now_ms);
		assert_eq!(report.deleted, 1);
		assert!(trash.join(keep_name).exists());
		assert!(!trash.join(delete_name).exists());
	}
	
	#[test]
	fn purge_noop_when_trash_missing() {
		let dir = tempdir().unwrap();
		let report = purge_expired_trash_with_now(dir.path(), 30, 2_000_000_000_000);
		assert_eq!(report, PurgeReport::default());
	}
	
	#[test]
	fn purge_deletes_old_top_level_file_and_directory_only() {
		let dir = tempdir().unwrap();
		let vault = dir.path();
		let trash = vault.join(".trash");
		fs::create_dir_all(&trash).unwrap();
		
		let now_ms = 2_000_000_000_000_u128;
		let old_ts = now_ms - days_to_ms(31);
		let new_ts = now_ms - days_to_ms(1);
		
		let old_file = trash.join(format!("OldFile (Root) {}.md", old_ts));
		let old_dir = trash.join(format!("OldDir (Root) {}", old_ts));
		let new_dir = trash.join(format!("NewDir (Root) {}", new_ts));
		
		fs::write(&old_file, "old").unwrap();
		fs::create_dir_all(&old_dir).unwrap();
		fs::write(old_dir.join("child.txt"), "child").unwrap();
		
		fs::create_dir_all(new_dir.join("nested")).unwrap();
		// This nested item looks old, but cleanup is top-level only.
		let nested_old = new_dir.join("nested").join(format!("Nested (Root) {}.md", old_ts));
		fs::write(&nested_old, "nested old").unwrap();
		
		let report = purge_expired_trash_with_now(vault, 30, now_ms);
		assert_eq!(report.deleted, 2);
		assert!(!old_file.exists());
		assert!(!old_dir.exists());
		assert!(new_dir.exists());
		assert!(nested_old.exists());
	}
	
	#[test]
	fn purge_counts_invalid_names() {
		let dir = tempdir().unwrap();
		let vault = dir.path();
		let trash = vault.join(".trash");
		fs::create_dir_all(&trash).unwrap();
		let mut f = fs::File::create(trash.join("no timestamp here.md")).unwrap();
		writeln!(f, "data").unwrap();
		
		let report = purge_expired_trash_with_now(vault, 30, 2_000_000_000_000_u128);
		assert_eq!(report.deleted, 0);
		assert_eq!(report.skipped_invalid_name, 1);
		assert_eq!(report.errors, 0);
	}
}
