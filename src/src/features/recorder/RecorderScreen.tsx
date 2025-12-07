import { useState, useEffect } from 'react';
import { MicSelector } from '../recording/MicSelector';
import { Controls } from '../recording/Controls';
import { Timer } from '../recording/Timer';
import { AppSelector } from '../recording/AppSelector';
import { useRecordingControls } from '../recording/api/useRecordingControls';
import { useMicrophones } from '../recording/api/useMicrophones';
import { AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

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
    const [selectedApp, setSelectedApp] = useState<{ pid: number, name: string } | null>(null);

    // Initial mic selection
    useEffect(() => {
        if (mics.length > 0 && !selectedMic) {
            setSelectedMic(mics[0].name); // Or from settings/store
        }
    }, [mics, selectedMic]);

    const handleStart = () => {
        if (selectedApp) {
            startMutation.mutate({
                pid: selectedApp.pid,
                micDevice: selectedMic || undefined
            });
        }
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
        <div className="flex flex-col h-full items-center justify-center p-6 gap-8 relative select-none">

            {/* Background ambient glow when recording */}
            <AnimatePresence>
                {isRecording && !isPaused && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-accent-primary/5 radial-gradient pointer-events-none rounded-2xl"
                    />
                )}
            </AnimatePresence>

            {/* App Selection State */}
            {!isRecording ? (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full max-w-md flex flex-col gap-6 z-10"
                >
                    <div className="bg-glass-surface border border-glass-border rounded-2xl p-6 shadow-xl space-y-6">
                        <AppSelector
                            onSelect={setSelectedApp}
                            selectedPid={selectedApp?.pid || null}
                        />

                        <div className="h-px bg-glass-border w-full" />

                        <MicSelector
                            devices={mics.map(m => ({ deviceId: m.name, label: m.name }))}
                            selectedDevice={selectedMic}
                            onSelect={(device) => {
                                setSelectedMic(device);
                                switchMicMutation.mutate(device);
                            }}
                            isLoading={isLoadingMics}
                        />
                    </div>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4 z-10"
                >
                    <div className="text-stone-400 text-sm font-medium tracking-wide">Recording {selectedApp?.name}</div>
                    <Timer isActive={!isPaused} />
                </motion.div>
            )}

            {/* Controls */}
            <div className="z-20 mt-auto pb-8">
                <Controls
                    isRecording={isRecording}
                    isPaused={isPaused}
                    onStart={handleStart}
                    onStop={handleStop}
                    onPause={() => pauseMutation.mutate()}
                    onResume={() => resumeMutation.mutate()}
                    disabled={!selectedApp && !isRecording}
                />
            </div>

            {/* Error Toast */}
            <AnimatePresence>
                {startMutation.isError && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-4 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 font-medium backdrop-blur-md"
                    >
                        <AlertCircle size={14} />
                        <span>Failed to start recording</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
