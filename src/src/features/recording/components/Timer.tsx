import { useState, useEffect } from 'react';

interface TimerProps {
    isActive: boolean;
    isPaused?: boolean;
    startTime: number | null;
}

export function Timer({ isActive, isPaused, startTime }: TimerProps) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        let interval: number | undefined;

        if (isActive && !isPaused) {
            interval = setInterval(() => {
                setNow(Date.now());
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [isActive, isPaused]);

    const elapsedSeconds = (startTime && isActive)
        ? Math.floor((now - startTime) / 1000)
        : 0;

    // Safety check for negative time (clock skew)
    const displaySeconds = Math.max(0, elapsedSeconds);

    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col items-center justify-center py-2">
            <span className="text-4xl font-light text-white tracking-wider font-mono">
                {formatTime(displaySeconds)}
            </span>
            {isActive && !isPaused && (
                <div className="flex items-center gap-2 mt-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs text-red-400 font-medium uppercase tracking-widest">Recording</span>
                </div>
            )}
            {isPaused && (
                <div className="flex items-center gap-2 mt-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-xs text-yellow-500 font-medium uppercase tracking-widest">Paused</span>
                </div>
            )}
        </div>
    );
}
