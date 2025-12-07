use std::sync::Arc;
use tokio::time::{interval, Duration};
use crate::services::db::{DatabaseService, SyncStatus};
use crate::error::AppError;
use serde::Deserialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Deserialize)]
struct RemoteJob {
    #[serde(rename = "id")]
    _id: String,
    status: String,
    transcript: Option<String>,
    summary: Option<String>,
    individual_transcripts: Option<String>,
    // Add speaker mappings if available in response
    // speaker_mappings: Option<Vec<RemoteSpeakerMapping>>, 
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
        tauri::async_runtime::spawn(async move {
            let mut ticker = interval(Duration::from_secs(10)); // Poll every 10 seconds
            loop {
                ticker.tick().await;
                if let Err(e) = Self::poll(db.clone(), app.clone()).await {
                    eprintln!("Sync error: {:?}", e);
                }
            }
        });
    }

    pub async fn upload_recording(&self, local_id: &str) -> Result<crate::services::db::CachedRecording, AppError> {
        // 1. Load Settings
        let settings = crate::services::storage::StorageService::load_settings(None)?;
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

    async fn poll(db: Arc<DatabaseService>, app: AppHandle) -> Result<(), AppError> {
        // Find jobs in PROCESSING_REMOTE state
        let recordings = db.get_all_recordings().await?;
        let pending: Vec<_> = recordings.into_iter()
            .filter(|r| r.sync_status == SyncStatus::ProcessingRemote.to_string())
            .collect();

        if pending.is_empty() {
            return Ok(());
        }

        // Get settings for API key
        let settings = crate::services::storage::StorageService::load_settings(None)?;
        if settings.scriberr_url.is_empty() || settings.api_key.is_empty() {
            return Ok(());
        }

        let client = reqwest::Client::new();
        let base_url = settings.scriberr_url.trim_end_matches('/');

        for rec in pending {
            if let Some(remote_id) = rec.remote_job_id {
                let url = format!("{}/api/v1/transcription/jobs/{}", base_url, remote_id);
                
                let resp = client.get(&url)
                    .header("X-API-Key", &settings.api_key)
                    .send()
                    .await;

                match resp {
                    Ok(response) => {
                        if response.status().is_success() {
                            let job: RemoteJob = response.json().await?;
                            
                            if job.status == "completed" {
                                let transcript = job.transcript.unwrap_or_default();
                                let summary = job.summary.as_deref();
                                let individuals = job.individual_transcripts.as_deref();
                                let audio_url = format!("{}/api/v1/transcription/jobs/{}/audio", base_url, remote_id);
                                
                                db.mark_as_synced(
                                    &rec.local_id,
                                    &transcript,
                                    summary,
                                    individuals,
                                    &audio_url
                                ).await?;
                                
                                // Clean up local file if expected? 
                                // Actually mark_as_synced handles DB. 
                                // We should check if we need to emit event.
                                if let Ok(updated_rec) = db.get_recording(&rec.local_id).await {
                                    let _ = app.emit("recording-updated", &updated_rec);
                                }

                                println!("Synced job: {}", remote_id);
                            } else if job.status == "failed" {
                                db.update_sync_status(&rec.local_id, SyncStatus::Failed).await?;
                                if let Ok(updated_rec) = db.get_recording(&rec.local_id).await {
                                    let _ = app.emit("recording-updated", &updated_rec);
                                }
                            }
                        }
                    },
                    Err(e) => {
                        eprintln!("Failed to fetch job {}: {}", remote_id, e);
                    }
                }
            }
        }

        Ok(())
    }
}
