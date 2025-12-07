import { useState, useEffect } from 'react';
import { MicSelector } from '../recording/MicSelector';
import { Controls } from '../recording/Controls';
import { Timer } from '../recording/Timer';
import { useRecordingControls } from '../recording/api/useRecordingControls';
import { useMicrophones } from '../recording/api/useMicrophones';
import { useRecordingStatus } from '../recording/api/useRecordingStatus'; // New Hook
import { AlertCircle, Mic } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Visualizer } from './Visualizer';

export function RecorderScreen() {
    // 1. Fetch Backend Status (Source of Truth)
    const { data: status, isLoading: isStatusLoading } = useRecordingStatus();

    // 2. Local controls (Mutations)
    const {
        startMutation,
        stopMutation,
        pauseMutation,
        resumeMutation,
        addToLedger
    } = useRecordingControls();

    const {
        data: mics = [],
        isLoading: isLoadingMics,
        switchMicMutation
    } = useMicrophones();

    const [selectedMic, setSelectedMic] = useState<string>('');
    const [includeSystemAudio] = useState(true);

    // Initial mic selection
    useEffect(() => {
        if (mics.length > 0 && !selectedMic) {
            setSelectedMic(mics[0].name);
        }
    }, [mics, selectedMic]);

    // Derived State
    const isRecording = status?.is_recording ?? false;
    const isPaused = status?.is_paused ?? false;
    const startTime = status?.start_time_ms ?? null;
    const isVisualizerActive = isRecording && !isPaused;

    const handleStart = () => {
        startMutation.mutate({
            micDevice: selectedMic || undefined,
            captureSystemAudio: includeSystemAudio
        });
    };

    const handleStop = () => {
        stopMutation.mutate(undefined, {
            onSuccess: (data) => {
                addToLedger.mutate({
                    filePath: data.file_path,
                    durationSec: data.duration_sec
                });
            }
        });
    };

    if (isStatusLoading) return null; // Or a loader

    return (
        <div className="flex flex-col h-full items-center justify-between p-8 relative select-none overflow-hidden">

            {/* Top Section */}
            <div className="w-full h-8" />


            {/* Center Section: Visualizer OR Start Button */}
            <div className="flex-1 flex items-center justify-center w-full relative">
                <AnimatePresence mode="wait">
                    {isRecording ? (
                        <motion.div
                            key="recording-hero"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative w-96 h-96 flex items-center justify-center"
                        >
                            {/* Visualizer Background - Absolute */}
                            <div className="absolute inset-0 z-0">
                                <Visualizer isActive={isVisualizerActive} />
                            </div>

                            {/* Timer - Center Overlay */}
                            <div className="z-10">
                                <Timer
                                    startTime={startTime}
                                    isActive={isVisualizerActive}
                                    isPaused={isPaused}
                                />
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="idle-hero"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative flex items-center justify-center p-12"
                        >
                            {/* Start Recording Button */}
                            <button
                                onClick={handleStart}
                                className="group relative w-24 h-24 flex items-center justify-center rounded-full transition-transform duration-300 hover:scale-105 active:scale-95 focus:outline-none outline-none ring-0"
                            >
                                {/* Outer Ring */}
                                <div className="absolute inset-0 rounded-full border-2 border-rose-500/30 group-hover:border-rose-500/50 transition-colors" />

                                {/* Inner Circle (The Button) */}
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center transition-all duration-300 shadow-[0_0_20px_rgba(244,63,94,0.3)] group-hover:shadow-[0_0_40px_rgba(244,63,94,0.6)]">
                                    <Mic className="text-white w-8 h-8 opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                                </div>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Section: Controls & Mic */}
            <div className="w-full max-w-sm flex flex-col items-center gap-8 z-20 pb-12">

                {/* Main Controls - Centered - ONLY SHOW WHEN RECORDING */}
                <AnimatePresence>
                    {isRecording && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                        >
                            <Controls
                                isRecording={isRecording}
                                isPaused={isPaused}
                                onStart={handleStart}
                                onStop={handleStop}
                                onPause={() => pauseMutation.mutate()}
                                onResume={() => resumeMutation.mutate()}
                                disabled={false}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mic Selector - Bottom pinned */}
                <div className="w-full">
                    <MicSelector
                        devices={mics.map(m => ({ deviceId: m.name, label: m.name }))}
                        selectedDevice={selectedMic}
                        onSelect={(mic) => {
                            setSelectedMic(mic);
                            if (isRecording) {
                                switchMicMutation.mutate(mic);
                            }
                        }}
                        isLoading={isLoadingMics}
                        disabled={isRecording}
                    />

                    {/* System Audio Text Indicator (Replaces Button) */}
                    <div className="mt-2 text-center">
                        <span className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                            System audio will also be recorded
                        </span>
                    </div>
                </div>
            </div>

            {/* Error Toast */}
            <AnimatePresence>
                {startMutation.isError && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-4 right-4 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 font-medium backdrop-blur-md shadow-lg z-50 pointer-events-none"
                    >
                        <AlertCircle size={14} />
                        <span>Failed to start recording</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
