import { useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import clsx from 'clsx';
import { AudioVisualizer } from './AudioVisualizer';

interface EmberPlayerProps {
    src: string;
    className?: string;
}

export function EmberPlayer({ src, className }: EmberPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const [hoverTime, setHoverTime] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const progressRef = useRef<HTMLDivElement>(null);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(e => console.error("Play failed:", e));
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressRef.current || !duration) return;
        const rect = progressRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.min(Math.max(0, x / rect.width), 1);
        setHoverTime(percent * duration);
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "00:00";
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    // Calculate progress percentage for background gradient
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className={clsx(
            "relative w-full overflow-hidden rounded-xl border border-glass-border/40 bg-glass-surface/50 backdrop-blur-xl shadow-2xl transition-all duration-500",
            className
        )}>
            {/* Hidden Audio Element */}
            {/* IMPORTANT: crossOrigin="anonymous" is required for Web Audio API to work with the proxy stream */}
            <audio
                ref={audioRef}
                src={src}
                crossOrigin="anonymous"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
            />

            {/* Visualizer Layer (Background) */}
            <div className="absolute inset-0 z-0 h-full w-full pointer-events-none opacity-40">
                <AudioVisualizer audioRef={audioRef} isPlaying={isPlaying} />
            </div>

            {/* Controls Layer (Foreground) */}
            <div className="relative z-10 flex flex-col px-4 py-3 gap-2">

                {/* Top Row: Play/Pause and Time */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={togglePlay}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary text-white shadow-lg shadow-accent-primary/20 hover:bg-accent-primary/90 hover:scale-105 active:scale-95 transition-all focus:outline-none"
                    >
                        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                    </button>

                    <div className="flex flex-col items-end">
                        <span className="font-mono text-xs font-medium text-accent-primary/80 tabular-nums tracking-wide">
                            {formatTime(currentTime)} <span className="text-stone-600">/</span> {formatTime(duration)}
                        </span>
                        <span className="text-[10px] text-stone-500 font-medium uppercase tracking-widest mt-0.5">
                            {isPlaying ? 'Playing' : 'Ready'}
                        </span>
                    </div>
                </div>

                {/* Bottom Row: Scrubber */}
                <div
                    ref={progressRef}
                    className="relative w-full h-4 flex items-center group cursor-pointer"
                    onMouseMove={handleMouseMove}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                >
                    {/* Tooltip */}
                    <div
                        className={clsx(
                            "absolute bottom-full mb-2 px-2 py-1 rounded bg-stone-900/90 text-[10px] font-mono text-white shadow-lg border border-white/10 pointer-events-none transition-opacity duration-200 backdrop-blur-sm z-30",
                            isHovering ? "opacity-100" : "opacity-0"
                        )}
                        style={{
                            left: `${duration > 0 ? (hoverTime / duration) * 100 : 0}%`,
                            transform: 'translateX(-50%)'
                        }}
                    >
                        {formatTime(hoverTime)}
                    </div>

                    {/* Track Background */}
                    <div className="absolute w-full h-[2px] bg-white/10 rounded-full overflow-hidden">
                        {/* Progress Fill */}
                        <div
                            className="h-full bg-accent-primary shadow-[0_0_10px_rgba(255,140,0,0.5)] transition-all duration-100 ease-linear"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>

                    {/* Range Input (Invisible Hitbox) */}
                    <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="absolute w-full h-full opacity-0 cursor-pointer z-20"
                    />

                    {/* Thumb Indicator (Visual only, follows progress) */}
                    <div
                        className="absolute h-2.5 w-2.5 bg-white rounded-full shadow-sm ml-[-5px] pointer-events-none transition-all duration-100 ease-linear group-hover:scale-125 opacity-0 group-hover:opacity-100"
                        style={{ left: `${progressPercent}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
