import { useState, useEffect } from 'react';
import { MicSelector } from '../recording/MicSelector';
import { Controls } from '../recording/Controls';
import { Timer } from '../recording/Timer';
import { useRecordingControls } from '../recording/api/useRecordingControls';
import { useMicrophones } from '../recording/api/useMicrophones';
import { AlertCircle, Volume2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';

export function RecorderScreen() {
    const {
        isRecording,
        isPaused,
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

    return (
        <div className="flex flex-col h-full items-center justify-between p-8 relative select-none overflow-hidden">

            {/* Top Section removed as requested */}
            <div className="w-full h-8" />


            {/* Middle Section: Timer or Mic Visual */}
            <div className="flex-1 flex flex-col items-center justify-center z-10 w-full relative">
                <AnimatePresence mode="wait">
                    {isRecording ? (
                        <motion.div
                            key="timer"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex flex-col items-center"
                        >
                            <Timer isActive={!isPaused} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="mic-hero"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative"
                        >
                            {/* Placeholder for Mic Visualizer */}
                            <div className="w-48 h-48 rounded-full bg-glass-surface/30 border border-glass-border flex items-center justify-center">
                                <div className="w-32 h-32 rounded-full bg-accent-primary/5 border border-accent-primary/10 flex items-center justify-center">
                                    <div className={clsx("w-3 h-3 rounded-full transition-colors duration-500", "bg-accent-primary")} />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Section: Controls & Mic */}
            <div className="w-full max-w-sm flex flex-col items-center gap-8 z-20 pb-12">

                {/* Main Controls - Centered */}
                <Controls
                    isRecording={isRecording}
                    isPaused={isPaused}
                    onStart={handleStart}
                    onStop={handleStop}
                    onPause={() => pauseMutation.mutate()}
                    onResume={() => resumeMutation.mutate()}
                    disabled={false}
                />

                {/* Mic Selector - Bottom pinned */}
                <div className="w-full">
                    <MicSelector
                        devices={mics.map(m => ({ deviceId: m.name, label: m.name }))}
                        selectedDevice={selectedMic}
                        onSelect={(device) => {
                            setSelectedMic(device);
                            switchMicMutation.mutate(device);
                        }}
                        isLoading={isLoadingMics}
                        disabled={isRecording}
                    />
                </div>

                {/* System Audio Subtitle */}
                <div className="flex items-center gap-1.5 text-xs text-stone-500/80 font-medium -mt-6">
                    {/* <Volume2 size={12} className="opacity-70" /> */}
                    <span>System audio will also be recorded</span>
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
        </div>
    );
}
