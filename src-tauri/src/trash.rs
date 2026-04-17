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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedTrashName {
	pub original_name: String,
	pub parent_label: String,
}

/// Generates a unique trash name using the current naming format:
/// "<stem-or-dirname> (<parent>) <timestamp>[.<original-ext>]"
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
		let (stem, extension) = split_name_parts(&filename);
		let suffix = extension.map(|ext| format!(".{ext}")).unwrap_or_default();
		Some(format!("{} ({}) {}{}", stem, clean_parent, timestamp, suffix))
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

fn strip_extension_for_parsing(name: &str) -> &str {
	match name.rsplit_once('.') {
		Some((stem, ext)) if !stem.is_empty() && !ext.contains(' ') => stem,
		_ => name,
	}
}

fn strip_collision_suffix_for_parsing(name: &str) -> &str {
	match name.rsplit_once(" [") {
		Some((stem, maybe_index)) if maybe_index.ends_with(']') => {
			let digits = &maybe_index[..maybe_index.len() - 1];
			if !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit()) {
				return stem;
			}
			name
		}
		_ => name,
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
	let without_ext = strip_extension_for_parsing(name);
	let without_collision = strip_collision_suffix_for_parsing(without_ext);
	let (_, timestamp) = without_collision.rsplit_once(' ')?;
	timestamp.parse::<u128>().ok()
}

pub fn parse_trash_entry_name(name: &str, is_dir: bool) -> Option<ParsedTrashName> {
	let (without_ext, extension) = if is_dir {
		(name, None)
	} else {
		let (stem, ext) = split_name_parts(name);
		(stem, ext)
	};
	let without_collision = strip_collision_suffix_for_parsing(without_ext);
	let (name_and_parent, timestamp) = without_collision.rsplit_once(' ')?;
	if timestamp.parse::<u128>().is_err() {
		return None;
	}
	let close_index = name_and_parent.rfind(')')?;
	let open_index = name_and_parent[..close_index].rfind(" (")?;
	let base_name = name_and_parent[..open_index].trim();
	let parent_label = name_and_parent[open_index + 2..close_index].trim();
	if base_name.is_empty() || parent_label.is_empty() {
		return None;
	}
	
	let original_name = match extension {
		Some(ext) => format!("{base_name}.{ext}"),
		None => base_name.to_string(),
	};
	
	Some(ParsedTrashName {
		original_name,
		parent_label: parent_label.to_string(),
	})
}

pub fn build_restored_destination_path(destination_dir: &Path, original_name: &str) -> Option<PathBuf> {
	let original_path = destination_dir.join(original_name);
	if !original_path.exists() {
		return Some(original_path);
	}
	
	let (stem, extension) = split_name_parts(original_name);
	let restored_stem = format!("{stem} (Restored)");
	let initial_name = match extension {
		Some(ext) => format!("{restored_stem}.{ext}"),
		None => restored_stem.clone(),
	};
	let initial_path = destination_dir.join(&initial_name);
	if !initial_path.exists() {
		return Some(initial_path);
	}
	
	let mut index = 1;
	loop {
		let candidate_name = match extension {
			Some(ext) => format!("{restored_stem} ({index}).{ext}"),
			None => format!("{restored_stem} ({index})"),
		};
		let candidate_path = destination_dir.join(candidate_name);
		if !candidate_path.exists() {
			return Some(candidate_path);
		}
		index += 1;
	}
}

pub fn permanently_delete_trash_entry(path: &Path) -> std::io::Result<()> {
	if path.is_dir() {
		fs::remove_dir_all(path)
	} else {
		fs::remove_file(path)
	}
}

pub fn restore_trashed_names_recursively(dir: &Path) -> std::io::Result<()> {
	if !dir.is_dir() {
		return Ok(());
	}
	
	let entries: Vec<PathBuf> = fs::read_dir(dir)?
		.filter_map(|entry| entry.ok().map(|value| value.path()))
		.collect();
	
	for entry_path in entries {
		let is_dir = entry_path.is_dir();
		let entry_name = entry_path
			.file_name()
			.and_then(|value| value.to_str())
			.unwrap_or_default();
		
		let renamed_path = match parse_trash_entry_name(entry_name, is_dir) {
			Some(parsed) => {
				let parent_dir = entry_path.parent().unwrap_or(dir);
				let next_path = build_restored_destination_path(parent_dir, &parsed.original_name)
					.unwrap_or_else(|| parent_dir.join(&parsed.original_name));
				fs::rename(&entry_path, &next_path)?;
				next_path
			}
			None => entry_path,
		};
		
		if renamed_path.is_dir() {
			restore_trashed_names_recursively(&renamed_path)?;
		}
	}
	
	Ok(())
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
		let file_name = format!("Photo (Daily) {}.png", ts);
		let file_with_collision = format!("Photo (Daily) {} [1].png", ts);
		let dir_name = format!("Folder (Projects) {}", ts);
		
		assert_eq!(parse_trash_timestamp(&file_name), Some(ts));
		assert_eq!(parse_trash_timestamp(&file_with_collision), Some(ts));
		assert_eq!(parse_trash_timestamp(&dir_name), Some(ts));
	}
	
	#[test]
	fn parse_timestamp_invalid_names_are_skipped() {
		assert_eq!(parse_trash_timestamp("no-timestamp.md"), None);
		assert_eq!(parse_trash_timestamp("Bad (Parent) abc.md"), None);
		assert_eq!(parse_trash_timestamp(""), None);
	}
	
	#[test]
	fn parse_trash_entry_name_extracts_original_file_name_and_parent() {
		let parsed =
			parse_trash_entry_name("Meeting Notes (Projects) 1740681450123.jpeg", false).unwrap();
		assert_eq!(parsed.original_name, "Meeting Notes.jpeg");
		assert_eq!(parsed.parent_label, "Projects");
	}

	#[test]
	fn parse_trash_entry_name_handles_collision_suffix_for_files() {
		let parsed =
			parse_trash_entry_name("Photo (Assets) 1740681450123 [2].png", false).unwrap();
		assert_eq!(parsed.original_name, "Photo.png");
		assert_eq!(parsed.parent_label, "Assets");
	}
	
	#[test]
	fn parse_trash_entry_name_extracts_original_folder_name_and_parent() {
		let parsed = parse_trash_entry_name("Drafts (Root) 1740681450123", true).unwrap();
		assert_eq!(parsed.original_name, "Drafts");
		assert_eq!(parsed.parent_label, "Root");
	}
	
	#[test]
	fn parse_trash_entry_name_rejects_invalid_names() {
		assert_eq!(parse_trash_entry_name("no timestamp here.md", false), None);
		assert_eq!(parse_trash_entry_name("MissingParent 123.md", false), None);
	}
	
	#[test]
	fn build_restored_destination_path_uses_original_name_when_available() {
		let dir = tempdir().unwrap();
		let destination = build_restored_destination_path(dir.path(), "Note.md").unwrap();
		assert_eq!(
			destination.file_name().and_then(|value| value.to_str()),
			Some("Note.md")
		);
	}
	
	#[test]
	fn build_restored_destination_path_adds_restored_suffix_and_counter_for_files() {
		let dir = tempdir().unwrap();
		let destination = dir.path();
		fs::write(destination.join("Note.md"), "").unwrap();
		fs::write(destination.join("Note (Restored).md"), "").unwrap();
		
		let resolved = build_restored_destination_path(destination, "Note.md").unwrap();
		
		assert_eq!(
			resolved.file_name().and_then(|value| value.to_str()),
			Some("Note (Restored) (1).md")
		);
	}
	
	#[test]
	fn build_restored_destination_path_adds_restored_suffix_and_counter_for_folders() {
		let dir = tempdir().unwrap();
		let destination = dir.path();
		fs::create_dir_all(destination.join("Project")).unwrap();
		fs::create_dir_all(destination.join("Project (Restored)")).unwrap();
		
		let resolved = build_restored_destination_path(destination, "Project").unwrap();
		
		assert_eq!(
			resolved.file_name().and_then(|value| value.to_str()),
			Some("Project (Restored) (1)")
		);
	}
	
	#[test]
	fn permanently_delete_trash_entry_removes_top_level_directory() {
		let dir = tempdir().unwrap();
		let trash_dir = dir.path().join(".trash");
		let trashed = trash_dir.join("Project (Root) 1740681450123");
		fs::create_dir_all(trashed.join("nested")).unwrap();
		
		permanently_delete_trash_entry(&trashed).unwrap();
		
		assert!(!trashed.exists());
	}
	
	#[test]
	fn restore_trashed_names_recursively_restores_nested_file_names() {
		let dir = tempdir().unwrap();
		let project_dir = dir.path().join("Project");
		fs::create_dir_all(&project_dir).unwrap();
		fs::write(
			project_dir.join("Child Note (Project) 1740681450123.png"),
			"nested",
		)
			.unwrap();
		
		restore_trashed_names_recursively(&project_dir).unwrap();
		
		assert!(project_dir.join("Child Note.png").exists());
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
