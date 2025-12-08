use sqlx::{sqlite::{SqlitePoolOptions, SqliteConnectOptions}, Pool, Sqlite};
use std::path::PathBuf;
use std::str::FromStr;
use crate::error::AppError;
use serde::{Serialize, Deserialize};
use specta::Type;
use tokio::fs;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
pub enum SyncStatus {
    DraftReady,
    Uploading,
    RemotePending, // Uploaded but not started/queued
    ProcessingRemote, // Actively processing
    CompletedSynced,
    Failed,
}

impl From<String> for SyncStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "DRAFT_READY" => SyncStatus::DraftReady,
            "UPLOADING" => SyncStatus::Uploading,
            "REMOTE_PENDING" => SyncStatus::RemotePending,
            "PROCESSING_REMOTE" => SyncStatus::ProcessingRemote,
            "COMPLETED_SYNCED" => SyncStatus::CompletedSynced,
            "FAILED" => SyncStatus::Failed,
            // Swagger / Remote statuses
            "uploaded" | "pending" => SyncStatus::RemotePending,
            "processing" => SyncStatus::ProcessingRemote,
            "completed" => SyncStatus::CompletedSynced,
            "failed" => SyncStatus::Failed,
            _ => SyncStatus::DraftReady, // Default fallback
        }
    }
}

impl ToString for SyncStatus {
    fn to_string(&self) -> String {
        match self {
            SyncStatus::DraftReady => "DRAFT_READY".to_string(),
            SyncStatus::Uploading => "UPLOADING".to_string(),
            SyncStatus::RemotePending => "REMOTE_PENDING".to_string(),
            SyncStatus::ProcessingRemote => "PROCESSING_REMOTE".to_string(),
            SyncStatus::CompletedSynced => "COMPLETED_SYNCED".to_string(),
            SyncStatus::Failed => "FAILED".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, sqlx::FromRow)]
pub struct CachedRecording {
    pub local_id: String,
    pub remote_job_id: Option<String>,
    pub title: String,
    pub duration_sec: f64,
    pub created_at: String, // Stored as ISO string or similar in DB, SQLite doesn't have native datetime type like Postgres but sqlx handles it as string or i64 usually. We'll use String for simplicity in transport.
    pub sync_status: String, 
    pub local_file_path: Option<String>,
    pub remote_audio_url: Option<String>,
    pub local_audio_path: Option<String>,
    pub file_hash: Option<String>,
    pub keep_offline: bool,
    pub transcript_text: Option<String>,
    pub summary_text: Option<String>,
    pub individual_transcripts_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, sqlx::FromRow)]
pub struct CachedSpeakerMap {
    pub id: i64,
    pub local_recording_id: String,
    pub original_speaker_label: String,
    pub display_name: String,
}

pub struct DatabaseService {
    pool: Pool<Sqlite>,
}

impl DatabaseService {
    pub async fn new(db_path: PathBuf) -> Result<Self, AppError> {
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).await.map_err(|e| AppError::Io(e.to_string()))?;
            }
        }
        
        let options = SqliteConnectOptions::from_str(&format!("sqlite://{}", db_path.to_string_lossy()))
            .map_err(|e| AppError::Database(e.to_string()))?
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .map_err(|e| AppError::Database(format!("Migration failed: {}", e)))?;

        Ok(Self { pool })
    }

    pub fn get_pool(&self) -> &Pool<Sqlite> {
        &self.pool
    }

    // CRUD Operations

    pub async fn create_draft(
        &self,
        title: String,
        duration_sec: f64,
        local_file_path: String,
    ) -> Result<CachedRecording, AppError> {
        let local_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let status = SyncStatus::DraftReady.to_string();

        sqlx::query!(
            r#"
            INSERT INTO cached_recordings (
                local_id, title, duration_sec, created_at, sync_status, local_file_path, keep_offline
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
            local_id,
            title,
            duration_sec,
            now,
            status,
            local_file_path,
            false
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

        self.get_recording(&local_id).await
    }

    pub async fn get_recording(&self, local_id: &str) -> Result<CachedRecording, AppError> {
        let rec = sqlx::query_as!(
            CachedRecording,
            "SELECT * FROM cached_recordings WHERE local_id = ?",
            local_id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(rec)
    }

    pub async fn get_all_recordings(&self) -> Result<Vec<CachedRecording>, AppError> {
        let recs = sqlx::query_as!(
            CachedRecording,
            "SELECT * FROM cached_recordings ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
        
        Ok(recs)
    }

    pub async fn update_sync_status(&self, local_id: &str, status: SyncStatus) -> Result<(), AppError> {
        let status_str = status.to_string();
        sqlx::query!(
            "UPDATE cached_recordings SET sync_status = ? WHERE local_id = ?",
            status_str,
            local_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn finalize_upload(&self, local_id: &str, remote_job_id: &str) -> Result<(), AppError> {
         let status = SyncStatus::ProcessingRemote.to_string();
         sqlx::query!(
            "UPDATE cached_recordings SET remote_job_id = ?, sync_status = ?, local_file_path = NULL WHERE local_id = ?",
            remote_job_id,
            status,
            local_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn mark_as_synced(
        &self, 
        local_id: &str, 
        transcript: &str, 
        summary: Option<&str>, 
        individual_transcripts_json: Option<&str>,
        remote_audio_url: &str
    ) -> Result<(), AppError> {
        let status = SyncStatus::CompletedSynced.to_string();
        sqlx::query!(
            r#"
            UPDATE cached_recordings 
            SET sync_status = ?, 
                transcript_text = ?, 
                summary_text = ?, 
                individual_transcripts_json = ?,
                remote_audio_url = ?
            WHERE local_id = ?
            "#,
            status,
            transcript,
            summary,
            individual_transcripts_json,
            remote_audio_url,
            local_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn set_local_audio_path(&self, local_id: &str, path: Option<String>) -> Result<(), AppError> {
        let keep_offline = path.is_some();
        sqlx::query!(
            "UPDATE cached_recordings SET local_audio_path = ?, keep_offline = ? WHERE local_id = ?",
            path,
            keep_offline,
            local_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }
    
    pub async fn delete_recording(&self, local_id: &str) -> Result<(), AppError> {
        sqlx::query!("DELETE FROM cached_recordings WHERE local_id = ?", local_id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn upsert_remote_recording(
        &self,
        remote_id: &str,
        title: &str,
        status_str: &str,
        created_at: &str,
        transcript: Option<&str>,
        summary: Option<&str>,
        individual_json: Option<&str>,
        remote_audio_url: Option<&str>
    ) -> Result<CachedRecording, AppError> {
        // Check if exists
        let existing = sqlx::query!(
            "SELECT local_id FROM cached_recordings WHERE remote_job_id = ?",
            remote_id
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

        let sync_status = SyncStatus::from(status_str.to_string()).to_string();

        // Parse transcript logic
        let mut db_transcript = transcript.map(|s| s.to_string());
        let mut db_individual_json = individual_json.map(|s| s.to_string());
        
        // If transcript looks like JSON, try to extract text and segments
        if let Some(t_str) = transcript {
            // Simple heuristic to avoid parsing plain text if possible, though safe to parse
            if t_str.trim().starts_with('{') {
               if let Ok(val) = serde_json::from_str::<serde_json::Value>(t_str) {
                    if let Some(txt) = val.get("text").and_then(|v| v.as_str()) {
                        db_transcript = Some(txt.to_string());
                    }
                    // If we have segments in the main transcript, use them if individual_json is empty
                    // or better, preferring the segments aligned with the text
                    if let Some(segs) = val.get("segments") {
                        db_individual_json = Some(segs.to_string());
                    }
               }
            }
        }

        if let Some(record) = existing {
            // Update
            sqlx::query!(
                r#"
                UPDATE cached_recordings 
                SET title = ?, 
                    sync_status = ?, 
                    transcript_text = ?, 
                    summary_text = ?, 
                    individual_transcripts_json = ?,
                    remote_audio_url = ?
                WHERE local_id = ?
                "#,
                title,
                sync_status,
                db_transcript,
                summary,
                db_individual_json,
                remote_audio_url,
                record.local_id
            )
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

            self.get_recording(&record.local_id).await
        } else {
            // Insert
            let local_id = Uuid::new_v4().to_string();
            // Typically use remote created_at, but we handle it as string
            
            sqlx::query!(
                r#"
                INSERT INTO cached_recordings (
                    local_id, remote_job_id, title, duration_sec, created_at, 
                    sync_status, transcript_text, summary_text, 
                    individual_transcripts_json, remote_audio_url, keep_offline
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
                local_id,
                remote_id,
                title,
                0.0, // Duration unknown from list? Or passed?
                created_at,
                sync_status,
                db_transcript,
                summary,
                db_individual_json,
                remote_audio_url,
                false
            )
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

            self.get_recording(&local_id).await
        }
    }

    pub async fn delete_remote_recording(&self, remote_id: &str) -> Result<(), AppError> {
        sqlx::query!("DELETE FROM cached_recordings WHERE remote_job_id = ?", remote_id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }
}
