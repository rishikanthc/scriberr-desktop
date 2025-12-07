import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

export interface RecordingStatus {
    is_recording: boolean;
    is_paused: boolean;
    start_time_ms: number | null;
}

export const useRecordingStatus = () => {
    return useQuery({
        queryKey: ['recordingStatus'],
        queryFn: async () => {
            return await invoke<RecordingStatus>('get_recording_status_command');
        },
        refetchInterval: 2000,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        staleTime: 0,
    });
};
