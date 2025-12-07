use std::sync::Arc;
use tokio::time::{interval, Duration};
use crate::services::db::{DatabaseService, SyncStatus};
use crate::error::AppError;
use serde::Deserialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Deserialize)]
struct RemoteJob {
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
