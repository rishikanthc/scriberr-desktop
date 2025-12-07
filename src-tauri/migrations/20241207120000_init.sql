-- Create cached_recordings table
CREATE TABLE cached_recordings (
    local_id TEXT PRIMARY KEY NOT NULL, -- UUID
    remote_job_id TEXT,        -- Nullable, from Server
    title TEXT NOT NULL,
    duration_sec REAL NOT NULL,
    created_at TEXT NOT NULL,
    
    -- Sync State
    sync_status TEXT NOT NULL, -- 'DRAFT_READY', 'UPLOADING', 'PROCESSING_REMOTE', 'COMPLETED_SYNCED', 'FAILED'
    
    -- Paths / URLs
    local_file_path TEXT, -- Original capture path (nullable after prune)
    remote_audio_url TEXT,
    
    -- Hybrid Storage / Pinning
    local_audio_path TEXT, -- Persistent path if downloaded/pinned
    file_hash TEXT,
    keep_offline BOOLEAN NOT NULL DEFAULT 0,
    
    -- Content Cache
    transcript_text TEXT,
    summary_text TEXT,
    individual_transcripts_json TEXT -- Raw JSON
);

-- Create cached_speaker_maps table
CREATE TABLE cached_speaker_maps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    local_recording_id TEXT NOT NULL,
    original_speaker_label TEXT NOT NULL,
    display_name TEXT NOT NULL,
    FOREIGN KEY(local_recording_id) REFERENCES cached_recordings(local_id) ON DELETE CASCADE
);

-- Create cached_tracks table
CREATE TABLE cached_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    local_recording_id TEXT NOT NULL,
    track_name TEXT NOT NULL,
    track_index INTEGER NOT NULL,
    FOREIGN KEY(local_recording_id) REFERENCES cached_recordings(local_id) ON DELETE CASCADE
);
