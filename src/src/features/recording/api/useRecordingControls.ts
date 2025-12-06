import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

export const useRecordingControls = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);

    const startMutation = useMutation({
        mutationFn: async (args: { pid: number; filename?: string; micDevice?: string }) => {
            await invoke('start_recording_command', {
                pid: args.pid,
                filename: args.filename,
                mic_device: args.micDevice
            });
        },
        onSuccess: () => {
            setIsRecording(true);
            setIsPaused(false);
        }
    });

    const pauseMutation = useMutation({
        mutationFn: async () => {
            await invoke('pause_recording_command');
        },
        onSuccess: () => {
            setIsPaused(true);
        }
    });

    const resumeMutation = useMutation({
        mutationFn: async () => {
            await invoke('resume_recording_command');
        },
        onSuccess: () => {
            setIsPaused(false);
        }
    });

    const stopMutation = useMutation({
        mutationFn: async () => {
            return await invoke<{ file_path: string; folder_path: string; duration_sec: number }>('stop_recording_command');
        },
        onSuccess: (data) => {
            setIsRecording(false);
            setIsPaused(false);
            setRecordingDuration(data.duration_sec);
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
        isRecording,
        isPaused,
        recordingDuration,
        startMutation,
        pauseMutation,
        resumeMutation,
        stopMutation,
        deleteRecording: deleteMutation,
        addToLedger: addLedgerMutation
    };
};
