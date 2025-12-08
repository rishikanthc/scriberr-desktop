use std::sync::Arc;
use tokio::time::{interval, Duration};
use crate::services::db::{DatabaseService, SyncStatus};
use crate::services::storage::StorageService;
use crate::error::AppError;
use serde::Deserialize;
use tauri::{AppHandle, Emitter};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct RemoteJob {
    pub id: String,
    pub title: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub deleted_at: Option<String>,
    pub transcript: Option<String>,
    pub summary: Option<String>,
    pub individual_transcripts: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListResponse {
    // Allows for { "jobs": [...] } or { "data": [...] }
    jobs: Option<Vec<RemoteJob>>,
    data: Option<Vec<RemoteJob>>,
}

pub struct SyncService {
    db: Arc<DatabaseService>,
    app_handle: AppHandle,
}

impl SyncService {
    pub fn new(db: Arc<DatabaseService>, app_handle: AppHandle) -> Self {
        Self { db, app_handle }
    }

    pub fn start(&self) {
        let db = self.db.clone();
        let app = self.app_handle.clone();
        
        // We need a way to clone self to call instance methods, but we can't easily clone SyncService if it's not Clone.
        // Usually we wrap SyncService in Arc, but here structure is: AppState has Arc<SyncService>.
        // So we can pass Arc<SyncService> to start?
        // Actually, existing code spawn a task.
        // We can reconstruct a lightweight sync helper or use static methods with db/app arguments,
        // OR we can just use the db/app handles and move the logic into a standalone async function or static method.
        // For now, I will use a static method approach or just inline logic to keep it simple, 
        // using a "perform_delta_sync_internal" that takes db/app.
        
        tauri::async_runtime::spawn(async move {
            let mut ticker = interval(Duration::from_secs(30)); // Poll less frequently for delta sync
            loop {
                ticker.tick().await;
                // We need to load settings inside the loop
                 if let Ok(settings) = StorageService::load_settings(None) {
                    if !settings.api_key.is_empty() && !settings.scriberr_url.is_empty() {
                         let last_sync = settings.last_sync_timestamp.clone();
                         // Logic below
                         if let Err(e) = Self::sync_jobs_internal(db.clone(), app.clone(), settings, last_sync).await {
                             eprintln!("Auto-sync error: {:?}", e);
                         }
                    }
                 }
            }
        });
    }

    pub async fn perform_full_sync(&self) -> Result<(), AppError> {
        let mut settings = StorageService::load_settings(None)?;
        Self::sync_jobs_internal(self.db.clone(), self.app_handle.clone(), settings.clone(), None).await?;
        
        settings.last_sync_timestamp = Some(chrono::Utc::now().to_rfc3339());
        StorageService::save_settings(&settings)?; 
        Ok(())
    }

    pub async fn perform_delta_sync(&self) -> Result<(), AppError> {
        let mut settings = StorageService::load_settings(None)?;
        let last_sync = settings.last_sync_timestamp.clone();
        
        Self::sync_jobs_internal(self.db.clone(), self.app_handle.clone(), settings.clone(), last_sync).await?;
        
        settings.last_sync_timestamp = Some(chrono::Utc::now().to_rfc3339());
        StorageService::save_settings(&settings)?;
        Ok(())
    }

    async fn sync_jobs_internal(
        db: Arc<DatabaseService>, 
        app: AppHandle, 
        settings: crate::services::storage::Settings, 
        updated_after: Option<String>
    ) -> Result<(), AppError> {
        let client = reqwest::Client::new();
        let base_url = settings.scriberr_url.trim_end_matches('/');
        let mut page = 1;
        let limit = 50;
        
        loop {
            let mut url = format!("{}/api/v1/transcription/list?page={}&limit={}", base_url, page, limit);
            if let Some(ref ua) = updated_after {
                url.push_str(&format!("&updated_after={}", ua));
            }

            let resp = client.get(&url)
                .header("X-API-Key", &settings.api_key)
                .send()
                .await
                .map_err(|e| AppError::Network(e.to_string()))?;

            if !resp.status().is_success() {
                return Err(AppError::Network(format!("Sync failed: {}", resp.status())));
            }

            // Try to parse as Value first to handle flexible response
            let body_val: Value = resp.json().await.map_err(|e| AppError::Network(e.to_string()))?;
            
            // Extract jobs array
            let jobs: Vec<RemoteJob> = if let Some(arr) = body_val.as_array() {
                serde_json::from_value(Value::Array(arr.clone())).unwrap_or_default()
            } else if let Some(obj) = body_val.as_object() {
                if let Some(j) = obj.get("jobs").or(obj.get("data")) {
                    serde_json::from_value(j.clone()).unwrap_or_default()
                } else {
                    vec![]
                }
            } else {
                vec![]
            };

            if jobs.is_empty() {
                break;
            }

            let count = jobs.len();

            for job in jobs {
                if job.deleted_at.is_some() {
                    db.delete_remote_recording(&job.id).await?;
                    let _ = app.emit("recording-deleted-remote", &job.id);
                } else {
                    let audio_url = format!("{}/api/v1/transcription/{}/audio", base_url, job.id);
                    
                    db.upsert_remote_recording(
                        &job.id,
                        job.title.as_deref().unwrap_or("Untitled"),
                        &job.status,
                        &job.created_at,
                        job.transcript.as_deref(),
                        job.summary.as_deref(),
                        job.individual_transcripts.as_deref(),
                        Some(&audio_url)
                    ).await?;
                }
            }

            if count < limit {
                break;
            }
            page += 1;
        }

        // Notify frontend that sync is done (optional, but helpful to refresh list)
        let _ = app.emit("sync-completed", ());
        
        Ok(())
    }

    pub async fn upload_recording(&self, local_id: &str) -> Result<crate::services::db::CachedRecording, AppError> {
        // 1. Load Settings
        let settings = StorageService::load_settings(None)?;
        if settings.scriberr_url.is_empty() || settings.api_key.is_empty() {
             return Err(AppError::Validation("Settings not configured".to_string()));
        }

        // 2. Get Recording
        let recording = self.db.get_recording(local_id).await
            .map_err(|_| AppError::NotFound("Recording not found".to_string()))?;

        // 3. Check File
        let file_path_str = recording.local_file_path.clone().ok_or(AppError::NotFound("File path missing".to_string()))?;
        let file_path = std::path::PathBuf::from(&file_path_str);
        if !file_path.exists() {
             return Err(AppError::NotFound("File not found on disk".to_string()));
        }

        // 4. Update Status
        self.db.update_sync_status(local_id, SyncStatus::Uploading).await?;

        // 5. Prepare Client
        let client = reqwest::Client::new();
        let base_url = settings.scriberr_url.trim_end_matches('/');
        let endpoint = format!("{}/api/v1/transcription/upload", base_url);

        // 6. Read File
        let file_bytes = tokio::fs::read(&file_path).await?;
        let filename = file_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("recording.wav")
            .to_string();

        let part = reqwest::multipart::Part::bytes(file_bytes).file_name(filename.clone());
        let form = reqwest::multipart::Form::new()
            .part("audio", part)
            .text("title", recording.title.clone());

        // 7. Send Request
        let response = client.post(&endpoint)
            .header("X-API-Key", &settings.api_key)
            .multipart(form)
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    let body: serde_json::Value = resp.json().await?;
                    let remote_id = body.get("id").and_then(|v| v.as_str())
                        .ok_or(AppError::Network("Invalid response from server".to_string()))?;
                    
                    self.db.finalize_upload(local_id, remote_id).await?;
                    
                    // Prune local file if not kept offline
                    if !recording.keep_offline {
                        let _ = tokio::fs::remove_file(&file_path).await;
                    }
                } else {
                    self.db.update_sync_status(local_id, SyncStatus::Failed).await?;
                    return Err(AppError::Network(format!("Upload failed: {}", resp.status())));
                }
            },
            Err(e) => {
                self.db.update_sync_status(local_id, SyncStatus::Failed).await?;
                return Err(AppError::Network(e.to_string()));
            }
        }

        Ok(self.db.get_recording(local_id).await?)
        
    }
}
