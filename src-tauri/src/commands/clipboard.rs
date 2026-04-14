use crate::error::TessellumError;
use crate::utils::{normalize_path, validate_path_in_vault};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardImportResult {
	pub imported_paths: Vec<String>,
	pub skipped_count: usize,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct DropFilesHeader {
	p_files: u32,
	pt_x: i32,
	pt_y: i32,
	f_nc: i32,
	f_wide: i32,
}

fn split_file_name(file_name: &str) -> (&str, &str) {
	match file_name.rsplit_once('.') {
		Some((stem, extension)) if !stem.is_empty() => (stem, extension),
		_ => (file_name, ""),
	}
}

fn next_available_name(file_name: &str, exists: impl Fn(&str) -> bool) -> String {
	if !exists(file_name) {
		return file_name.to_string();
	}
	
	let (stem, extension) = split_file_name(file_name);
	let suffix = if extension.is_empty() {
		String::new()
	} else {
		format!(".{extension}")
	};
	
	let mut copy_index = 1;
	loop {
		let candidate = format!("{stem} ({copy_index}){suffix}");
		if !exists(&candidate) {
			return candidate;
		}
		copy_index += 1;
	}
}

fn resolve_unique_target_path(destination_dir: &Path, file_name: &str) -> PathBuf {
	let resolved_name = next_available_name(file_name, |candidate| destination_dir.join(candidate).exists());
	destination_dir.join(resolved_name)
}

async fn copy_file_entry(source_path: &Path, destination_dir: &Path) -> Result<String, TessellumError> {
	let file_name = source_path
		.file_name()
		.and_then(|value| value.to_str())
		.ok_or_else(|| TessellumError::Validation("Clipboard item must have a valid file name".to_string()))?;
	let target_path = resolve_unique_target_path(destination_dir, file_name);
	
	tokio::fs::copy(source_path, &target_path).await.map_err(TessellumError::from)?;
	Ok(normalize_path(&target_path.to_string_lossy()))
}

async fn copy_directory_contents(source_dir: &Path, destination_dir: &Path) -> Result<(), TessellumError> {
	let mut pending_dirs = vec![(source_dir.to_path_buf(), destination_dir.to_path_buf())];
	
	while let Some((current_source, current_destination)) = pending_dirs.pop() {
		tokio::fs::create_dir_all(&current_destination).await.map_err(TessellumError::from)?;
		
		let mut entries = tokio::fs::read_dir(&current_source).await.map_err(TessellumError::from)?;
		while let Some(entry) = entries.next_entry().await.map_err(TessellumError::from)? {
			let entry_path = entry.path();
			let entry_type = entry.file_type().await.map_err(TessellumError::from)?;
			let target_path = current_destination.join(entry.file_name());
			
			if entry_type.is_dir() {
				pending_dirs.push((entry_path, target_path));
				continue;
			}
			
			if entry_type.is_file() {
				tokio::fs::copy(&entry_path, &target_path).await.map_err(TessellumError::from)?;
			}
		}
	}
	
	Ok(())
}

async fn copy_directory_entry(source_path: &Path, destination_dir: &Path) -> Result<String, TessellumError> {
	let dir_name = source_path
		.file_name()
		.and_then(|value| value.to_str())
		.ok_or_else(|| TessellumError::Validation("Clipboard item must have a valid folder name".to_string()))?;
	let target_path = resolve_unique_target_path(destination_dir, dir_name);
	
	copy_directory_contents(source_path, &target_path).await?;
	Ok(normalize_path(&target_path.to_string_lossy()))
}

async fn copy_clipboard_entry(source_path: &Path, destination_dir: &Path) -> Result<Option<String>, TessellumError> {
	if !source_path.exists() {
		return Ok(None);
	}
	
	if source_path.is_file() {
		return copy_file_entry(source_path, destination_dir).await.map(Some);
	}
	
	if source_path.is_dir() {
		return copy_directory_entry(source_path, destination_dir).await.map(Some);
	}
	
	Ok(None)
}

fn build_file_drop_data(paths: &[PathBuf]) -> Result<Vec<u8>, TessellumError> {
	let header = DropFilesHeader {
		p_files: std::mem::size_of::<DropFilesHeader>() as u32,
		pt_x: 0,
		pt_y: 0,
		f_nc: 0,
		f_wide: 1,
	};
	
	let joined_paths = paths
		.iter()
		.map(|path| {
			path.to_str()
				.ok_or_else(|| TessellumError::Validation("Clipboard path must be valid UTF-8".to_string()))
		})
		.collect::<Result<Vec<_>, _>>()?
		.join("\0");
	
	let wide_paths: Vec<u16> = format!("{joined_paths}\0\0").encode_utf16().collect();
	let payload_size = std::mem::size_of::<DropFilesHeader>() + (wide_paths.len() * std::mem::size_of::<u16>());
	let mut payload = vec![0u8; payload_size];
	
	unsafe {
		std::ptr::copy_nonoverlapping(
			(&header as *const DropFilesHeader).cast::<u8>(),
			payload.as_mut_ptr(),
			std::mem::size_of::<DropFilesHeader>(),
		);
		std::ptr::copy_nonoverlapping(
			wide_paths.as_ptr().cast::<u8>(),
			payload.as_mut_ptr().add(std::mem::size_of::<DropFilesHeader>()),
			wide_paths.len() * std::mem::size_of::<u16>(),
		);
	}
	
	Ok(payload)
}

#[cfg(target_os = "windows")]
fn read_clipboard_file_paths() -> Result<Vec<PathBuf>, TessellumError> {
	use windows_sys::Win32::System::DataExchange::{CloseClipboard, GetClipboardData, OpenClipboard};
	use windows_sys::Win32::UI::Shell::DragQueryFileW;
	
	const CF_HDROP_FORMAT: u32 = 15;
	
	unsafe {
		if OpenClipboard(std::ptr::null_mut()) == 0 {
			return Err(TessellumError::Internal("Failed to open the system clipboard".to_string()));
		}
		
		let result = (|| {
			let handle = GetClipboardData(CF_HDROP_FORMAT);
			if handle.is_null() {
				return Ok(Vec::new());
			}
			
			let file_count = DragQueryFileW(handle as _, u32::MAX, std::ptr::null_mut(), 0);
			let mut file_paths = Vec::with_capacity(file_count as usize);
			
			for index in 0..file_count {
				let required_length = DragQueryFileW(handle as _, index, std::ptr::null_mut(), 0);
				if required_length == 0 {
					continue;
				}
				
				let mut buffer = vec![0u16; required_length as usize + 1];
				let copied_length = DragQueryFileW(handle as _, index, buffer.as_mut_ptr(), buffer.len() as u32);
				if copied_length == 0 {
					continue;
				}
				
				let path = String::from_utf16_lossy(&buffer[..copied_length as usize]);
				file_paths.push(PathBuf::from(path));
			}
			
			Ok(file_paths)
		})();
		
		CloseClipboard();
		result
	}
}

#[cfg(not(target_os = "windows"))]
fn read_clipboard_file_paths() -> Result<Vec<PathBuf>, TessellumError> {
	Err(TessellumError::Internal(
		"OS clipboard file paste is currently only supported on Windows".to_string(),
	))
}

#[cfg(target_os = "windows")]
fn write_clipboard_file_paths(paths: &[PathBuf]) -> Result<(), TessellumError> {
	use windows_sys::Win32::Foundation::HANDLE;
	use windows_sys::Win32::System::DataExchange::{
		CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
	};
	use windows_sys::Win32::System::Memory::{
		GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE,
	};
	
	const CF_HDROP_FORMAT: u32 = 15;
	let payload = build_file_drop_data(paths)?;
	
	unsafe {
		if OpenClipboard(std::ptr::null_mut()) == 0 {
			return Err(TessellumError::Internal("Failed to open the system clipboard".to_string()));
		}
		
		let result = (|| {
			if EmptyClipboard() == 0 {
				return Err(TessellumError::Internal("Failed to clear the system clipboard".to_string()));
			}
			
			let handle = GlobalAlloc(GMEM_MOVEABLE, payload.len());
			if handle.is_null() {
				return Err(TessellumError::Internal("Failed to allocate clipboard memory".to_string()));
			}
			
			let buffer = GlobalLock(handle) as *mut u8;
			if buffer.is_null() {
				return Err(TessellumError::Internal("Failed to lock clipboard memory".to_string()));
			}
			
			std::ptr::copy_nonoverlapping(payload.as_ptr(), buffer, payload.len());
			GlobalUnlock(handle);
			
			let clipboard_handle: HANDLE = SetClipboardData(CF_HDROP_FORMAT, handle);
			if clipboard_handle.is_null() {
				return Err(TessellumError::Internal("Failed to write file paths to the system clipboard".to_string()));
			}
			
			Ok(())
		})();
		
		CloseClipboard();
		result
	}
}

#[cfg(not(target_os = "windows"))]
fn write_clipboard_file_paths(_: &[PathBuf]) -> Result<(), TessellumError> {
	Err(TessellumError::Internal(
		"OS clipboard file copy is currently only supported on Windows".to_string(),
	))
}

#[tauri::command]
pub async fn write_file_paths_to_clipboard(paths: Vec<String>) -> Result<(), TessellumError> {
	let path_bufs = paths.into_iter().map(PathBuf::from).collect::<Vec<_>>();
	write_clipboard_file_paths(&path_bufs)
}

#[tauri::command]
pub async fn import_clipboard_files(
	vault_path: String,
	destination_dir: String,
) -> Result<ClipboardImportResult, TessellumError> {
	validate_path_in_vault(&destination_dir, &vault_path).map_err(TessellumError::Validation)?;
	
	let destination_path = Path::new(&destination_dir);
	let destination_metadata = tokio::fs::metadata(destination_path).await.map_err(TessellumError::from)?;
	if !destination_metadata.is_dir() {
		return Err(TessellumError::Validation("Destination must be a folder".to_string()));
	}
	
	let clipboard_paths = read_clipboard_file_paths()?;
	let mut imported_paths = Vec::new();
	let mut skipped_count = 0usize;
	
	for source_path in clipboard_paths {
		match copy_clipboard_entry(&source_path, destination_path).await? {
			Some(imported_path) => imported_paths.push(imported_path),
			None => skipped_count += 1,
		}
	}
	
	Ok(ClipboardImportResult {
		imported_paths,
		skipped_count,
	})
}

#[cfg(test)]
mod tests {
	use super::{
		build_file_drop_data, copy_clipboard_entry, next_available_name, resolve_unique_target_path, DropFilesHeader,
	};
	use std::path::PathBuf;
	use tempfile::tempdir;
	
	#[test]
	fn auto_rename_preserves_extension_when_destination_exists() {
		let taken = vec!["photo.png".to_string(), "photo (1).png".to_string()];
		let next = next_available_name("photo.png", |candidate| taken.iter().any(|value| value == candidate));
		
		assert_eq!(next, "photo (2).png");
	}
	
	#[test]
	fn auto_rename_handles_extensionless_names() {
		let taken = vec!["LICENSE".to_string()];
		let next = next_available_name("LICENSE", |candidate| taken.iter().any(|value| value == candidate));
		
		assert_eq!(next, "LICENSE (1)");
	}
	
	#[test]
	fn build_file_drop_data_uses_double_null_terminated_utf16_paths() {
		let payload = build_file_drop_data(&[
			PathBuf::from("C:/vault/one.md"),
			PathBuf::from("C:/vault/two.md"),
		]).expect("payload");
		
		let header_len = std::mem::size_of::<DropFilesHeader>();
		let utf16_units = payload[header_len..]
			.chunks_exact(2)
			.map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
			.collect::<Vec<_>>();
		
		assert!(utf16_units.ends_with(&[0, 0]));
		let text = String::from_utf16_lossy(&utf16_units);
		assert!(text.contains("C:/vault/one.md"));
		assert!(text.contains("C:/vault/two.md"));
	}
	
	#[test]
	fn resolve_unique_target_path_renames_conflicting_folder_names() {
		let temp = tempdir().expect("tempdir");
		std::fs::create_dir(temp.path().join("Folder")).expect("existing folder");
		
		let target = resolve_unique_target_path(temp.path(), "Folder");
		
		assert_eq!(target.file_name().and_then(|value| value.to_str()), Some("Folder (1)"));
	}
	
	#[tokio::test]
	async fn copy_clipboard_entry_copies_directories_recursively() {
		let source_root = tempdir().expect("source");
		let destination_root = tempdir().expect("destination");
		let source_dir = source_root.path().join("Folder");
		let nested_dir = source_dir.join("nested");
		
		std::fs::create_dir_all(&nested_dir).expect("nested dir");
		std::fs::write(source_dir.join("top.md"), "top").expect("top file");
		std::fs::write(nested_dir.join("deep.md"), "deep").expect("nested file");
		
		let imported = copy_clipboard_entry(&source_dir, destination_root.path())
			.await
			.expect("copy")
			.expect("imported path");
		
		assert!(imported.ends_with("Folder"));
		assert!(destination_root.path().join("Folder").join("top.md").exists());
		assert!(destination_root.path().join("Folder").join("nested").join("deep.md").exists());
	}
}
