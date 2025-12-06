import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TimerProps {
    isActive: boolean;
}

export function Timer({ isActive }: TimerProps) {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;

        if (isActive) {
            interval = setInterval(() => {
                setSeconds(s => s + 1);
            }, 1000);
        } else if (!isActive && seconds !== 0) {
            // Paused
            if (interval) clearInterval(interval);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive, seconds]);

    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col items-center">
            <motion.div
                className="text-6xl font-mono font-medium text-white tracking-widest tabular-nums drop-shadow-lg"
                animate={{ opacity: isActive ? [1, 0.8, 1] : 0.5 }}
                transition={{ duration: 2, repeat: isActive ? Infinity : 0, ease: "easeInOut" }}
            >
                {formatTime(seconds)}
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
            {!isActive && seconds > 0 && (
                <div className="mt-2 text-yellow-500/80 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    Paused
                </div>
            )}
        </div>
    );
}
