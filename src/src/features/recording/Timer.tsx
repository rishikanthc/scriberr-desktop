import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TimerProps {
    startTime: number | null; // Unix millis
    isActive: boolean; // isRecording && !isPaused
    isPaused: boolean;
}

export function Timer({ startTime, isActive, isPaused }: TimerProps) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!startTime) {
            setElapsed(0);
            return;
        }

        // Update immediately
        const update = () => {
            const now = Date.now();
            const diff = Math.max(0, Math.floor((now - startTime) / 1000));
            setElapsed(diff);
        };
        update();

        if (!isActive) return;

        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [startTime, isActive]);

    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col items-center">
            <motion.div
                className="text-5xl font-mono font-medium text-white tracking-widest tabular-nums drop-shadow-lg"
                animate={{ opacity: isActive ? [1, 0.8, 1] : 0.5 }}
                transition={{ duration: 2, repeat: isActive ? Infinity : 0, ease: "easeInOut" }}
            >
                {formatTime(elapsed)}
            </motion.div>
            {isActive && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-2 flex items-center gap-2"
                >
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-white/60 text-xs font-medium uppercase tracking-wider">Recording</span>
                </motion.div>
            )}
            {isPaused && (
                <div className="mt-2 text-yellow-500/80 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    Paused
                </div>
            )}
        </div>
    );
}
