import { useMutation } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

export const useRecordingControls = () => {
    const startMutation = useMutation({
        mutationFn: async (args: { pid: number; filename: string; micDevice: string | null }) => {
            await invoke('start_recording_command', args);
        }
    });

    const pauseMutation = useMutation({
        mutationFn: async () => {
            await invoke('pause_recording_command');
        }
    });

    const resumeMutation = useMutation({
        mutationFn: async () => {
            await invoke('resume_recording_command');
        }
    });

    const stopMutation = useMutation({
        mutationFn: async () => {
            return await invoke<{ file_path: string; folder_path: string; duration_sec: number }>('stop_recording_command');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (path: string) => {
            await invoke('delete_recording_command', { path });
        }
    });

    const addLedgerMutation = useMutation({
        mutationFn: async (args: { filePath: string; durationSec: number }) => {
            await invoke('add_recording_command', { filePath: args.filePath, durationSec: args.durationSec });
        }
    });

    return {
        start: startMutation,
        pause: pauseMutation,
        resume: resumeMutation,
        stop: stopMutation,
        deleteRecording: deleteMutation,
        addToLedger: addLedgerMutation
    };
};
