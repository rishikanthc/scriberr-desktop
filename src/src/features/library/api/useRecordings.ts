import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { LedgerEntry } from '../../../types';

export type { LedgerEntry }; // Re-export for convenience if needed, but better to import from types

export const useRecordings = () => {
    return useQuery({
        queryKey: ['recordings'],
        queryFn: async () => {
            return await invoke<LedgerEntry[]>('get_recordings_command');
        },
    });
};

export const useDeleteRecording = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (localId: string) => {
            await invoke('delete_recording_entry_command', { localId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recordings'] });
        },
    });
};

export const useUploadRecording = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (localId: string) => {
            return await invoke<LedgerEntry>('upload_recording_command', { localId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recordings'] });
        },
    });
};
