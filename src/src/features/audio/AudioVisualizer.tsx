import { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
    audioRef: React.RefObject<HTMLAudioElement | null>;
    isPlaying: boolean;
    isHovering?: boolean;
    hoverPercent?: number;
}

// Global cache to prevent "HTMLMediaElement already connected" errors
const audioSourceMap = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

export function AudioVisualizer({ audioRef, isPlaying, isHovering = false, hoverPercent = 0 }: AudioVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const rafRef = useRef<number | null>(null);

    // Physics State
    const peakPositionsRef = useRef<number[]>([]);
    const peakDropsRef = useRef<number[]>([]);

    // Resize State for Sharpness
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // 1. Handle Resize
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                setDimensions({
                    width: clientWidth * window.devicePixelRatio,
                    height: clientHeight * window.devicePixelRatio
                });
            }
        };

        updateSize();
        const observer = new ResizeObserver(updateSize);
        if (containerRef.current) observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, []);

    // 2. Audio Graph Initialization
    useEffect(() => {
        if (!audioRef.current) return;

        const initAudio = () => {
            if (!contextRef.current) {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                contextRef.current = new AudioContextClass();
            }
            const ctx = contextRef.current;

            if (!analyzerRef.current) {
                const analyzer = ctx.createAnalyser();
                // Increased FFT size to 256 (128 bins) to support higher density bars
                analyzer.fftSize = 256;
                analyzer.smoothingTimeConstant = 0.85;
                analyzerRef.current = analyzer;
            }

            const audioEl = audioRef.current!;

            if (audioSourceMap.has(audioEl)) {
                try {
                    const source = audioSourceMap.get(audioEl)!;
                    source.connect(analyzerRef.current!);
                    analyzerRef.current!.connect(ctx.destination);
                } catch (e) { /* ignore */ }
            } else {
                try {
                    const source = ctx.createMediaElementSource(audioEl);
                    source.connect(analyzerRef.current!);
                    analyzerRef.current!.connect(ctx.destination);
                    audioSourceMap.set(audioEl, source);
                } catch (e) {
                    console.error("Audio Graph Error:", e);
                }
            }
        };

        initAudio();

        if (isPlaying && contextRef.current?.state === 'suspended') {
            contextRef.current.resume();
        }

    }, [audioRef, isPlaying]);

    // 3. The Drawing Loop
    useEffect(() => {
        if (!canvasRef.current || !analyzerRef.current || dimensions.width === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        // --- VISUAL CONFIGURATION ---
        const SCALE = window.devicePixelRatio;
        const TILE_SIZE = 6 * SCALE;  // Increased from 4 -> 6
        const COL_GAP = 1 * SCALE;    // Tight adjacency (1px gap)
        const ROW_GAP = 2 * SCALE;    // Vertical stack gap
        const TOTAL_ROW_HEIGHT = TILE_SIZE + ROW_GAP;
        const COL_WIDTH = TILE_SIZE + COL_GAP;

        // Create Gradient (Warm Flame)
        const gradient = ctx.createLinearGradient(0, 0, 0, dimensions.height);
        // Top: Luminous Amber (Not white, but bright yellow-gold)
        gradient.addColorStop(0, '#FCD34D'); // Amber-300
        // Mid: Brand Accent
        gradient.addColorStop(0.4, '#FF8C00'); // Orange-500
        // Bottom: Deep Heat
        gradient.addColorStop(1, '#C2410C'); // Orange-700

        const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);

        const draw = () => {
            if (!analyzerRef.current) return;

            if (isPlaying) {
                analyzerRef.current.getByteFrequencyData(dataArray);
            }

            ctx.clearRect(0, 0, dimensions.width, dimensions.height);

            // Dynamic Bar Count: Fill the width
            const barCount = Math.floor(dimensions.width / COL_WIDTH);

            // Sync physics arrays size
            if (peakPositionsRef.current.length !== barCount) {
                peakPositionsRef.current = new Array(barCount).fill(0);
                peakDropsRef.current = new Array(barCount).fill(0);
            }

            const maxTilesColumn = Math.floor(dimensions.height / TOTAL_ROW_HEIGHT);

            for (let i = 0; i < barCount; i++) {
                // Map visualization bars to frequency bins (focus on 0-70% of freq range)
                const binIndex = Math.floor(i * (dataArray.length / barCount) * 0.7);
                let value = dataArray[binIndex] || 0;

                // Boost visuals
                value = Math.min(255, value * 1.15);

                const x = i * COL_WIDTH; // No dynamic spacing, just strict grid

                // Calculate Active Tiles
                const activeTiles = Math.floor((value / 255) * maxTilesColumn);

                // Peak Physics
                if (activeTiles > peakPositionsRef.current[i]) {
                    peakPositionsRef.current[i] = activeTiles;
                    peakDropsRef.current[i] = 0;
                } else {
                    peakDropsRef.current[i]++;
                    if (peakDropsRef.current[i] > 5) {
                        peakPositionsRef.current[i] = Math.max(0, peakPositionsRef.current[i] - 1);
                        peakDropsRef.current[i] = 0;
                    }
                }
                const peakTile = peakPositionsRef.current[i];

                // Draw Column
                for (let j = 0; j < maxTilesColumn; j++) {
                    const y = dimensions.height - (j * TOTAL_ROW_HEIGHT) - TILE_SIZE;

                    // 2. Active Signal
                    if (j < activeTiles) {
                        ctx.fillStyle = gradient;
                        ctx.beginPath();
                        ctx.roundRect(x, y, TILE_SIZE, TILE_SIZE, 1 * SCALE);
                        ctx.fill();
                    }
                    // 3. Peak Hold (Luminous Amber)
                    else if (j === peakTile && peakTile > 0 && isPlaying) {
                        // Changed from White to Warm Amber
                        ctx.fillStyle = "#FDE68A"; // Amber-200
                        ctx.globalAlpha = 0.9;
                        ctx.beginPath();
                        ctx.roundRect(x, y, TILE_SIZE, TILE_SIZE, 1 * SCALE);
                        ctx.fill();
                        ctx.globalAlpha = 1.0;
                    }
                }
            }

            if (isPlaying || peakPositionsRef.current.some(p => p > 0)) {
                rafRef.current = requestAnimationFrame(draw);
            }
        };

        draw();

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isPlaying, isHovering, hoverPercent, dimensions]);

    return (
        <div ref={containerRef} className="w-full h-full">
            <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                style={{ width: '100%', height: '100%' }}
                className="block mix-blend-screen opacity-90"
            />
        </div>
    );
}