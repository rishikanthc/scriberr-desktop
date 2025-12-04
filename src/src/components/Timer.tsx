import { useState, useEffect } from 'react';

interface TimerProps {
    isActive: boolean;
}

export function Timer({ isActive }: TimerProps) {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        let interval: number | undefined;

        if (isActive) {
            interval = setInterval(() => {
                setSeconds(s => s + 1);
            }, 1000);
        }
        // Don't reset seconds when paused (isActive becomes false), only on unmount or explicit reset if needed.
        // But here isActive toggles with pause.
        // We need a way to reset.
        // Actually, the Timer component is unmounted when not recording in App.tsx logic:
        // {isRecording ? <Timer ... /> : <AppSelector ... />}
        // So state is lost. We should lift state up or keep Timer mounted but hidden?
        // Or just accept it resets? No, that's bad.
        // Let's fix App.tsx to keep Timer state or move state up.
        // For now, let's just fix the interval.

        return () => clearInterval(interval);
    }, [isActive]);

    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col items-center justify-center py-2">
            <span className="text-4xl font-light text-white tracking-wider font-mono">
                {formatTime(seconds)}
            </span>
            {isActive && (
                <div className="flex items-center gap-2 mt-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs text-red-400 font-medium uppercase tracking-widest">Recording</span>
                </div>
            )}
        </div>
    );
}
