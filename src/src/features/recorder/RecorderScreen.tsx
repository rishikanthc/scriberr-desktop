import { useState, useEffect } from 'react';
import { MicSelector } from '../recording/MicSelector';
import { Controls } from '../recording/Controls';
import { Timer } from '../recording/Timer';
import { useRecordingControls } from '../recording/api/useRecordingControls';
import { useMicrophones } from '../recording/api/useMicrophones';
import { useRecordingStatus } from '../recording/api/useRecordingStatus'; // New Hook
import { Mic, Pencil } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Visualizer } from './Visualizer';
import { toast } from 'sonner';

export function RecorderScreen() {
    // 1. Fetch Backend Status (Source of Truth)
    const { data: status, isLoading: isStatusLoading } = useRecordingStatus();

    // 2. Local controls (Mutations)
    const {
        startMutation,
        stopMutation,
        pauseMutation,
        resumeMutation
    } = useRecordingControls();

    const {
        data: mics = [],
        isLoading: isLoadingMics,
        switchMicMutation
    } = useMicrophones();

    const [selectedMic, setSelectedMic] = useState<string>('');
    const [includeSystemAudio] = useState(true);
    const [filename, setFilename] = useState("");

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
            captureSystemAudio: includeSystemAudio,
            filename: filename || undefined
        }, {
            onError: () => toast.error("Failed to start recording")
        });
    };

    const handleStop = () => {
        stopMutation.mutate(filename || undefined, {
            onSuccess: () => {
                // addToLedger handled by stop_recording_command backend logic now
                // addToLedger.mutate(...) removed to prevent duplicates
                toast.success("Recording saved", {
                    description: filename ? `Saved as ${filename}.wav` : "Saved successfully"
                });
                setFilename(""); // Reset
            },
            onError: () => toast.error("Failed to save recording")
        });
    };

    if (isStatusLoading) return null; // Or a loader

    return (
        <div className="flex flex-col h-full items-center justify-between p-8 relative select-none overflow-hidden">

            {/* Top Section - Filename Input */}
            <div className="w-full flex justify-center h-16 items-center z-20">
                <div className="relative group">
                    <input
                        type="text"
                        placeholder="Recording Name..."
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        className="bg-glass-input border border-glass-border text-white placeholder:text-white/30 text-center rounded-xl px-4 py-2 w-64 focus:w-80 transition-all duration-300 outline-none backdrop-blur-md focus:border-accent-primary focus:ring-1 focus:ring-accent-primary shadow-lg"
                    />
                    <Pencil size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-focus-within:text-white/50 transition-colors" />
                </div>
            </div>


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
                                <div className="absolute inset-0 rounded-full border-2 border-accent-primary/30 group-hover:border-accent-primary/50 transition-colors" />

                                {/* Inner Circle (The Button) */}
                                <div className="w-20 h-20 rounded-full bg-accent-primary flex items-center justify-center transition-all duration-300 shadow-[0_0_15px_rgba(255,140,0,0.3)] group-hover:shadow-[0_0_25px_rgba(255,140,0,0.5)] hover:bg-accent-hover">
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
        </div >
    );
}
