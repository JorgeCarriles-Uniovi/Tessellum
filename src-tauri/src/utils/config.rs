use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::error::TessellumError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyNotesConfig {
	#[serde(default = "default_daily_notes_path_template")]
	pub path_template: String,
	#[serde(default = "default_daily_notes_template_name")]
	pub template_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
	#[serde(default)]
	pub dailyNotes: DailyNotesConfig,
}

impl Default for DailyNotesConfig {
	fn default() -> Self {
		Self {
			path_template: default_daily_notes_path_template(),
			template_name: default_daily_notes_template_name(),
		}
	}
}

impl Default for AppConfig {
	fn default() -> Self {
		Self {
			dailyNotes: DailyNotesConfig::default(),
		}
	}
}

fn default_daily_notes_path_template() -> String {
	"Daily/{YYYY}/{MM}/{DD}.md".to_string()
}

fn default_daily_notes_template_name() -> String {
	"Daily".to_string()
}

pub fn config_path(vault_path: &str) -> PathBuf {
	Path::new(vault_path).join(".tessellum").join("config.json")
}

pub fn load_or_init_config(vault_path: &str) -> Result<AppConfig, TessellumError> {
	let path = config_path(vault_path);
	if let Some(parent) = path.parent() {
		fs::create_dir_all(parent)?;
	}
	
	if path.exists() {
		match fs::read_to_string(&path) {
			Ok(raw) => match serde_json::from_str::<AppConfig>(&raw) {
				Ok(cfg) => return Ok(cfg),
				Err(e) => {
					log::warn!("Invalid config.json, using defaults: {}", e);
				}
			},
			Err(e) => {
				log::warn!("Failed to read config.json, using defaults: {}", e);
			}
		}
	}
	
	let cfg = AppConfig::default();
	write_config(&path, &cfg)?;
	Ok(cfg)
}

fn write_config(path: &Path, config: &AppConfig) -> Result<(), TessellumError> {
	let raw = serde_json::to_string_pretty(config)
		.map_err(|e| TessellumError::Internal(e.to_string()))?;
	fs::write(path, raw)?;
	Ok(())
}
