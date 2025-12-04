import { Mic, Square, Pause, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface ControlsProps {
    isRecording: boolean;
    isPaused: boolean;
    onStart: () => void;
    onStop: () => void;
    onPause: () => void;
    onResume: () => void;
    disabled: boolean;
}

export function Controls({ isRecording, isPaused, onStart, onStop, onPause, onResume, disabled }: ControlsProps) {
    return (
        <div className="flex justify-center items-center gap-6 py-6">
            {!isRecording ? (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onStart}
                    disabled={disabled}
                    className={clsx(
                        "w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all",
                        disabled
                            ? "bg-white/10 cursor-not-allowed opacity-50"
                            : "bg-red-500 hover:bg-red-400 text-white shadow-red-500/20"
                    )}
                >
                    <Mic size={24} fill="currentColor" />
                </motion.button>
            ) : (
                <>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={isPaused ? onResume : onPause}
                        className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shadow-lg backdrop-blur-md border border-white/10"
                    >
                        {isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onStop}
                        className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shadow-lg backdrop-blur-md border border-white/10"
                    >
                        <Square size={24} fill="currentColor" />
                    </motion.button>
                </>
            )}
        </div>
    );
}
