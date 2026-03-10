#[derive(Debug, thiserror::Error)]
pub enum TessellumError {
	#[error("Database error: {0}")]
	Database(#[from] sqlx::Error),
	#[error("File not found: {0}")]
	NotFound(String),
	#[error("Validation error: {0}")]
	Validation(String),
	#[error("I/O error: {0}")]
	Io(#[from] std::io::Error),
	#[error("Internal error: {0}")]
	Internal(String),
}

impl From<TessellumError> for tauri::ipc::InvokeError {
	fn from(e: TessellumError) -> Self {
		tauri::ipc::InvokeError::from(e.to_string())
	}
}
