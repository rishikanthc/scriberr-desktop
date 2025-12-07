import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

interface VisualizerProps {
    isActive: boolean;
}

export function Visualizer({ isActive }: VisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioLevelRef = useRef(0);
    const smoothedLevelRef = useRef(0);
    const rotationRef = useRef(0);
    const timeRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        // Listen to audio level events from Rust
        const unlistenPromise = listen<number>('audio-level', (event) => {
            const raw = event.payload;
            // Strong curve for responsiveness
            const amplified = Math.min(Math.pow(raw, 0.4) * 1.8, 2.0);
            audioLevelRef.current = amplified;
        });

        return () => {
            unlistenPromise.then(unlisten => unlisten());
        };
    }, []);

    useEffect(() => {
        if (!isActive) {
            cancelAnimationFrame(animationFrameRef.current || 0);
            return;
        }

        const render = () => {
            if (!canvasRef.current) return;
            const ctx = canvasRef.current.getContext('2d');
            if (!ctx) return;

            const width = canvasRef.current.width;
            const height = canvasRef.current.height;
            const centerX = width / 2;
            const centerY = height / 2;

            // Interpolation
            const target = audioLevelRef.current;
            if (target > smoothedLevelRef.current) {
                smoothedLevelRef.current += (target - smoothedLevelRef.current) * 0.25; // Snappy up
            } else {
                smoothedLevelRef.current += (target - smoothedLevelRef.current) * 0.1; // Smooth down
            }

            const energy = smoothedLevelRef.current;

            // Slow rotation for dynamism
            // Slow rotation for dynamism
            rotationRef.current += 0.002 + (energy * 0.005);
            timeRef.current += 0.05;

            ctx.clearRect(0, 0, width, height);

            // Drawing settings
            const barCount = 120;
            const innerRadius = 115; // Significantly larger to clear the timer text
            const maxBarHeight = 50; // Slightly shorter bars to fit in canvas

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(rotationRef.current);

            for (let i = 0; i < barCount; i++) {
                const percent = i / barCount;
                const angle = percent * Math.PI * 2;

                // We fake a spectrum by using sine waves of different frequencies relative to position
                // This makes it look like complex audio analysis even though it's just RMS driven
                const frequencyMod = Math.sin(angle * 10) * 0.5 + Math.cos(angle * 23) * 0.3;
                const dynamicHeight = (energy * maxBarHeight) * (1 + frequencyMod * 0.5);

                // Minimal height so it's not empty
                const barHeight = 4 + dynamicHeight;

                ctx.rotate((Math.PI * 2) / barCount);

                // Bar Drawing
                // We use rounded line caps for elegance
                ctx.beginPath();
                ctx.moveTo(0, innerRadius);
                ctx.lineTo(0, innerRadius + barHeight);

                // Mystic Palette: Cyan -> Violet -> Blue
                // Cool tones contrast beautifully with the warm stone-800 background
                // Cyan (180) -> Blue (240) -> Purple (280)
                const baseHue = 190 + (percent * 100);
                const hueShift = Math.sin(timeRef.current + i * 0.1) * 20; // Animated shift
                const hue = baseHue + hueShift;

                // Brighter, cleaner look
                const opacity = 0.5 + (energy * 0.5);

                ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${opacity})`;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';

                // Cool glow
                ctx.shadowBlur = energy * 12;
                ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.6)`;

                ctx.stroke();
            }

            // Inner Ring - Subtle guide
            ctx.beginPath();
            ctx.arc(0, 0, innerRadius - 8, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 191, 0, 0.1)'; // Fixed subtle orange
            ctx.lineWidth = 1;
            ctx.shadowBlur = 0;
            ctx.stroke();

            ctx.restore();

            animationFrameRef.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isActive]);

    return (
        <canvas
            ref={canvasRef}
            width={400}
            height={400}
            className="w-full h-full"
        />
    );
}
