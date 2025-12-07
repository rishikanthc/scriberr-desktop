import { Play, Pause } from 'lucide-react';
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
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onStart}
                disabled={disabled}
                className="w-20 h-20 rounded-full bg-rose-500 hover:bg-rose-600 shadow-xl shadow-rose-500/20 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden transition-colors"
            >
                {/* Ripple or Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-8 h-8 rounded-full bg-white/90 shadow-sm" />
            </motion.button>
        );
    }

    return (
        <div className="flex items-center justify-center gap-8">
            <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.1)" }}
                whileTap={{ scale: 0.95 }}
                onClick={isPaused ? onResume : onPause}
                disabled={disabled}
                className="w-14 h-14 rounded-full bg-white/5 border border-white/10 shadow-lg flex items-center justify-center text-white backdrop-blur-md disabled:opacity-50 relative transition-colors"
            >
                {isPaused ? <Play size={24} fill="currentColor" className="ml-1" /> : <Pause size={24} fill="currentColor" />}
            </motion.button>

            <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05, borderColor: "rgba(244, 63, 94, 0.3)" }}
                whileTap={{ scale: 0.95 }}
                onClick={onStop}
                disabled={disabled}
                className="w-20 h-20 rounded-full bg-white/5 border-2 border-transparent hover:bg-rose-500/10 shadow-lg flex items-center justify-center text-white group backdrop-blur-md disabled:opacity-50 relative transition-all"
            >
                <div className="w-8 h-8 rounded bg-rose-500 shadow-lg shadow-rose-500/30 group-hover:bg-rose-600 transition-all" />
            </motion.button>
        </div>
    );
}
