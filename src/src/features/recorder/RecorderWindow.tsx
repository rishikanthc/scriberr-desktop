import { useState, useEffect } from 'react';
import { TitleBar } from '../../components/TitleBar';
import { MicSelector } from '../recording/MicSelector';
import { Controls } from '../recording/Controls';
import { Timer } from '../recording/Timer';
import { AppSelector } from '../recording/AppSelector';
import { useRecordingControls } from '../recording/api/useRecordingControls';
import { useMicrophones } from '../recording/api/useMicrophones';
import { AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export function RecorderWindow() {
    const {
        isRecording,
        isPaused,
        startMutation,
        stopMutation,
        pauseMutation,
        resumeMutation,
        addToLedger // Added
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
        <div className="h-screen w-screen bg-stone-700/85 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col text-white select-none">
            <TitleBar variant="recorder" />

            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8 relative">

                {/* Background ambient glow when recording */}
                <AnimatePresence>
                    {isRecording && !isPaused && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-red-500/5 radial-gradient pointer-events-none"
                        />
                    )}
                </AnimatePresence>

                {/* App Selection State */}
                {!isRecording ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full flex flex-col gap-4 z-10"
                    >
                        <AppSelector
                            onSelect={setSelectedApp}
                            selectedPid={selectedApp?.pid || null}
                        />

                        <div className="h-px bg-white/10 w-full" />

                        <MicSelector
                            devices={mics.map(m => ({ deviceId: m.name, label: m.name }))}
                            selectedDevice={selectedMic}
                            onSelect={(device) => {
                                setSelectedMic(device);
                                switchMicMutation.mutate(device);
                            }}
                            isLoading={isLoadingMics}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center gap-2 z-10"
                    >
                        <div className="text-white/60 text-sm font-medium">Recording {selectedApp?.name}</div>
                        <Timer isActive={!isPaused} />
                    </motion.div>
                )}

                {/* Controls */}
                <div className="z-20 mt-auto">
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

                {/* Error Toast Generic Placeholder */}
                {startMutation.isError && (
                    <div className="absolute bottom-4 bg-red-500/10 border border-red-500/20 text-red-200 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                        <AlertCircle size={14} />
                        <span>Failed to start recording</span>
                    </div>
                )}
            </div>
        </div>
    );
}
