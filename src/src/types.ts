export interface RunnableApp {
    id: string;
    pid: number;
    name: string;
    icon: number[];
}

export interface LedgerEntry {
    local_id: string;
    remote_id: string | null;
    file_path: string;
    upload_status: string;
    created_at: string;
    retry_count: number;
    duration_sec: number;
}

export interface Settings {
    scriberr_url: string;
    api_key: string;
    output_path: string;
}
