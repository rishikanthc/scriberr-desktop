import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
    audioRef: React.RefObject<HTMLAudioElement | null>;
    isPlaying: boolean;
}

export function AudioVisualizer({ audioRef, isPlaying }: AudioVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (!audioRef.current) return;

        // Initialize Audio Context (once)
        const initAudio = () => {
            if (contextRef.current) return;

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            contextRef.current = ctx;

            const analyzer = ctx.createAnalyser();
            analyzer.fftSize = 128; // ~64 bars
            analyzer.smoothingTimeConstant = 0.8;
            analyzerRef.current = analyzer;

            try {
                const source = ctx.createMediaElementSource(audioRef.current!);
                source.connect(analyzer);
                analyzer.connect(ctx.destination);
                sourceRef.current = source;
            } catch (e) {
                console.error("Audio Graph Error:", e);
            }
        };

        // Initialize on first interaction or mount if already capable
        // Browsers require user gesture for AudioContext usually, but since we are triggering play via UI, it might be fine.
        // We'll lazy init if needed, but for now init on mount/update.
        initAudio();

        return () => {
            // Cleanup tricky with AudioContext, usually kept alive or suspended.
            // keeping context alive is fine for SPA.
        };
    }, [audioRef]);

    useEffect(() => {
        if (!canvasRef.current || !analyzerRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Visualizer Config
        const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
        const tileHeight = 4;
        const gap = 2;
        const totalBlockSize = tileHeight + gap;

        const draw = () => {
            if (!analyzerRef.current) return;
            analyzerRef.current.getByteFrequencyData(dataArray);

            // Responsive Canvas
            const width = canvas.width;
            const height = canvas.height;
            ctx.clearRect(0, 0, width, height);

            // Render Config
            const barCount = dataArray.length; // 64
            const barWidth = (width / barCount) * 0.8; // 80% width, 20% gap
            const barGap = (width / barCount) * 0.2;

            for (let i = 0; i < barCount; i++) {
                const value = dataArray[i];
                const x = i * (barWidth + barGap);

                // Calculate how many tiles active
                // value is 0-255. 
                // Height available: height. 
                // Max tiles: height / totalBlockSize
                const maxTiles = Math.floor(height / totalBlockSize);
                const activeTiles = Math.floor((value / 255) * maxTiles);

                for (let j = 0; j < maxTiles; j++) {
                    const y = height - (j * totalBlockSize) - tileHeight;

                    // Color Logic
                    if (j < activeTiles) {
                        // Active
                        // Gradient: Bottom (Orange) -> Top (Yellow/White)
                        if (j > maxTiles * 0.8) {
                            ctx.fillStyle = "#FFF7ED"; // stone-50, peak
                        } else if (j > maxTiles * 0.5) {
                            ctx.fillStyle = "#FF8C00"; // Primary Orange
                        } else {
                            ctx.fillStyle = "#C2410C"; // Darker Orange/Rust
                        }

                        // Add Glow to active tiles?
                        // heavy perf hit on canvas 2d usually. kept simple flat color for now.
                    } else {
                        // Passive Grid
                        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
                    }

                    ctx.fillRect(x, y, barWidth, tileHeight);
                }
            }

            if (isPlaying) {
                rafRef.current = requestAnimationFrame(draw);
            }
        };

        if (isPlaying) {
            // Resume context if suspended
            if (contextRef.current?.state === 'suspended') {
                contextRef.current.resume();
            }
            draw();
        } else {
            // Draw one frame of silence or current state, then stop
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            // Optional: clear or dim? keeping last frame looks weird, better clear or animate down.
            // For now just stop loop.
        }

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isPlaying]);

    return (
        <canvas
            ref={canvasRef}
            width={320}
            height={64}
            className="w-full h-full mix-blend-screen opacity-90"
        />
    );
}
