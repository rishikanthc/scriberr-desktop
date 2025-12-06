import { Play, Pause, Square } from 'lucide-react';
import { motion } from 'framer-motion';

interface ControlsProps {
    isRecording: boolean;
    isPaused: boolean;
    onStart: () => void;
    onStop: () => void;
    onPause: () => void;
    onResume: () => void;
    disabled?: boolean;
}

export function Controls({
    isRecording,
    isPaused,
    onStart,
    onStop,
    onPause,
    onResume,
    disabled = false
}: ControlsProps) {

    if (!isRecording) {
        return (
            <button
                onClick={onStart}
                disabled={disabled}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-500/20 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
            >
                <div className="w-6 h-6 rounded-full bg-white group-hover:scale-90 transition-transform" />
            </button>
        );
    }

    return (
        <div className="flex items-center justify-center gap-6">
            <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={isPaused ? onResume : onPause}
                disabled={disabled}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all active:scale-95 flex items-center justify-center text-white backdrop-blur-md disabled:opacity-50"
            >
                {isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
            </motion.button>

            <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={onStop}
                disabled={disabled}
                className="w-16 h-16 rounded-full bg-white/10 hover:bg-red-500/20 border border-white/10 hover:border-red-500/50 transition-all active:scale-95 flex items-center justify-center text-white group backdrop-blur-md disabled:opacity-50"
            >
                <div className="w-6 h-6 rounded bg-red-500 group-hover:scale-110 transition-transform shadow-lg shadow-red-500/30" />
            </motion.button>
        </div>
    );
}
