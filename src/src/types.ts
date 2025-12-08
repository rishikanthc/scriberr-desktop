export interface RunnableApp {
    id: string;
    pid: number;
    name: string;
    icon: number[];
}

export interface CachedRecording {
    local_id: string;
    remote_job_id: string | null;
    title: string;
    duration_sec: number;
    created_at: string;
    sync_status: string; // 'DRAFT_READY', 'UPLOADING', 'PROCESSING_REMOTE', 'COMPLETED_SYNCED', 'FAILED'
    local_file_path: string | null;
    remote_audio_url: string | null;
    local_audio_path: string | null;
    keep_offline: boolean;
    transcript_text: string | null;
    summary_text: string | null;
    individual_transcripts_json: string | null;
}

export type LedgerEntry = CachedRecording; // Alias for backward compatibility during migration

export interface Settings {
    scriberr_url: string;
    api_key: string;
    output_path: string;
    last_sync_timestamp?: string | null;
}
