use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default)]
    pub binary_path: Option<String>,
    #[serde(default)]
    pub extra_cli_args: Option<String>,
    #[serde(default = "default_true")]
    pub auto_reattach: bool,
    #[serde(default)]
    pub show_gitignored: bool,
    #[serde(default = "default_file_size_limit")]
    pub file_size_limit: u64,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_font_size")]
    pub font_size: u32,
    #[serde(default = "default_log_level")]
    pub log_level: String,
    #[serde(default = "default_max_retries")]
    pub max_retries: u32,
    #[serde(default)]
    pub last_attached_folder: Option<String>,
}

fn default_true() -> bool {
    true
}
fn default_file_size_limit() -> u64 {
    512_000
}
fn default_theme() -> String {
    "dark".into()
}
fn default_font_size() -> u32 {
    14
}
fn default_log_level() -> String {
    "info".into()
}
fn default_max_retries() -> u32 {
    5
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            binary_path: None,
            extra_cli_args: None,
            auto_reattach: true,
            show_gitignored: false,
            file_size_limit: default_file_size_limit(),
            theme: default_theme(),
            font_size: default_font_size(),
            log_level: default_log_level(),
            max_retries: default_max_retries(),
            last_attached_folder: None,
        }
    }
}

fn settings_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".pi-mono-shell")
        .join("settings.json")
}

pub fn load_settings() -> AppSettings {
    let path = settings_path();
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        AppSettings::default()
    }
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}
