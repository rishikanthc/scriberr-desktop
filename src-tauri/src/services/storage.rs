use std::path::PathBuf;
use serde::{Serialize, Deserialize};
use specta::Type;
use crate::error::AppError;
use validator::Validate;

#[derive(Serialize, Deserialize, Clone, Type, Validate)]
pub struct Settings {
    #[validate(url(message = "Invalid Scriberr URL"))]
    pub scriberr_url: String,
    #[validate(length(min = 1, message = "API Key is required"))]
    pub api_key: String,
    pub output_path: String,
    pub last_sync_timestamp: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Type)]
pub struct LedgerEntry {
    pub local_id: String,
    pub remote_id: Option<String>,
    pub file_path: String,
    pub upload_status: String, // "incomplete", "uploaded", "failed"
    pub created_at: String,
    pub duration_sec: f64,
    pub retry_count: u32,
}

pub struct StorageService;

impl StorageService {
    fn get_ledger_path() -> PathBuf {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join(".config").join("scriberr-companion").join("ledger.json")
    }

    fn get_ledger_tmp_path() -> PathBuf {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join(".config").join("scriberr-companion").join("ledger.json.tmp")
    }

    fn get_settings_path() -> PathBuf {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join(".config").join("scriberr-companion").join("settings.json")
    }

    pub fn load_ledger() -> Result<Vec<LedgerEntry>, AppError> {
        let path = Self::get_ledger_path();
        let tmp_path = Self::get_ledger_tmp_path();

        if tmp_path.exists() {
            let _ = std::fs::rename(&tmp_path, &path);
        }

        if !path.exists() {
            return Ok(Vec::new());
        }

        let content = std::fs::read_to_string(&path)?;
        let entries = serde_json::from_str(&content)?;
        Ok(entries)
    }

    pub fn save_ledger(entries: &Vec<LedgerEntry>) -> Result<(), AppError> {
        let path = Self::get_ledger_path();
        let tmp_path = Self::get_ledger_tmp_path();

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let json = serde_json::to_string_pretty(entries)?;
        
        std::fs::write(&tmp_path, json)?;
        std::fs::rename(&tmp_path, &path)?;
        
        Ok(())
    }

    pub fn load_settings(default_path: Option<String>) -> Result<Settings, AppError> {
        let path = Self::get_settings_path();
        // Determine sensible default if not provided
        let default_output = default_path.unwrap_or_else(|| {
             let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
             PathBuf::from(home).join("Documents").join("ScriberrRecordings").to_string_lossy().to_string()
        });

        if !path.exists() {
            return Ok(Settings {
                scriberr_url: "".to_string(),
                api_key: "".to_string(),
                output_path: default_output,
                last_sync_timestamp: None,
            });
        }
        
        let content = std::fs::read_to_string(path)?;
        let mut settings: Settings = serde_json::from_str(&content)?;
        
        if settings.output_path.is_empty() {
            settings.output_path = default_output;
        }

        Ok(settings)
    }

    pub fn save_settings(settings: &Settings) -> Result<(), AppError> {
        let path = Self::get_settings_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        let json = serde_json::to_string_pretty(settings)?;
        std::fs::write(path, json)?;
        Ok(())
    }
    pub fn migrate_recordings(old_path_str: &str, new_path_str: &str) -> Result<(), AppError> {
        let old_path = PathBuf::from(old_path_str);
        let new_path = PathBuf::from(new_path_str);

        if old_path.exists() {
             if !new_path.exists() {
                std::fs::create_dir_all(&new_path)?;
            }

            // Move files physically
            let entries = std::fs::read_dir(&old_path)?;
            for entry in entries {
                let entry = entry?;
                let path = entry.path();
                if path.is_file() {
                    let file_name = path.file_name().ok_or(AppError::Unexpected("Invalid filename".into()))?;
                    let new_file_path = new_path.join(file_name);
                    std::fs::rename(&path, &new_file_path)?;
                }
            }
        }

        if let Ok(mut ledger_entries) = Self::load_ledger() {
             let mut changed = false;
             for entry in &mut ledger_entries {
                let entry_path = PathBuf::from(&entry.file_path);
                if entry_path.starts_with(&old_path) {
                    if let Ok(stripped) = entry_path.strip_prefix(&old_path) {
                        let new_entry_path = new_path.join(stripped);
                        entry.file_path = new_entry_path.to_string_lossy().to_string();
                        changed = true;
                    }
                }
            }
            if changed {
                 Self::save_ledger(&ledger_entries)?;
            }
        }

        Ok(())
    }
}
