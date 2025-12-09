import { useRef, useState, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import clsx from "clsx";
import { AudioVisualizer } from "./AudioVisualizer";

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
	const [isDragging, setIsDragging] = useState(false);
	const progressRef = useRef<HTMLDivElement>(null);

	const togglePlay = () => {
		if (!audioRef.current) return;
		if (isPlaying) {
			audioRef.current.pause();
		} else {
			audioRef.current.play().catch((e) => console.error("Play failed:", e));
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

	const calculateTimeFromEvent = (e: React.MouseEvent | MouseEvent) => {
		if (!progressRef.current || !duration) return 0;
		const rect = progressRef.current.getBoundingClientRect();
		let x = e.clientX - rect.left;
		x = Math.max(0, Math.min(x, rect.width));
		return (x / rect.width) * duration;
	};

	const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		setIsDragging(true);
		const time = calculateTimeFromEvent(e);
		if (audioRef.current) {
			audioRef.current.currentTime = time;
			setCurrentTime(time);
		}
	};

	useEffect(() => {
		const handleGlobalMouseMove = (e: MouseEvent) => {
			if (isDragging && audioRef.current && progressRef.current) {
				const time = calculateTimeFromEvent(e);
				audioRef.current.currentTime = time;
				setCurrentTime(time);
			}
		};

		const handleGlobalMouseUp = () => {
			setIsDragging(false);
		};

		if (isDragging) {
			window.addEventListener("mousemove", handleGlobalMouseMove);
			window.addEventListener("mouseup", handleGlobalMouseUp);
		}

		return () => {
			window.removeEventListener("mousemove", handleGlobalMouseMove);
			window.removeEventListener("mouseup", handleGlobalMouseUp);
		};
	}, [isDragging, duration]);

	const handleHoverMove = (e: React.MouseEvent<HTMLDivElement>) => {
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
		return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
	};

	const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
	const hoverPercent = duration > 0 ? hoverTime / duration : 0;

	return (
		<div
			className={clsx(
				// Level 2 Card Style
				"relative w-full overflow-hidden rounded-2xl border border-[var(--color-glass-border)]",
				"bg-[var(--color-glass-surface)] backdrop-blur-2xl shadow-xl transition-all duration-500",
				// Inner highlight
				"shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
				className,
			)}
		>
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
			<div className="absolute inset-0 z-0 h-full w-full pointer-events-none opacity-30 mix-blend-screen">
				<AudioVisualizer
					audioRef={audioRef}
					isPlaying={isPlaying}
					isHovering={isHovering}
					hoverPercent={hoverPercent}
				/>
			</div>

			{/* Controls Layer */}
			<div className="relative z-10 flex flex-col px-5 py-4 gap-3">
				{/* Top Row */}
				<div className="flex items-center justify-between">
					{/* Primary Action: Gradient Button */}
					<button
						onClick={togglePlay}
						className="flex h-11 w-11 items-center justify-center rounded-full bg-[image:var(--gradient-brand)] text-white shadow-[0_0_15px_var(--color-accent-glow)] hover:brightness-110 active:scale-95 transition-all focus:outline-none cursor-pointer"
					>
						{isPlaying ? (
							<Pause size={20} fill="currentColor" />
						) : (
							<Play size={20} fill="currentColor" className="ml-0.5" />
						)}
					</button>

					<div className="flex flex-col items-end">
						<span className="font-mono text-xs font-medium text-[var(--color-accent-text)] tabular-nums tracking-wide drop-shadow-sm">
							{formatTime(currentTime)}{" "}
							<span className="text-white/20 mx-0.5">/</span>{" "}
							<span className="text-[var(--color-text-muted)]">
								{formatTime(duration)}
							</span>
						</span>
						<span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest mt-0.5 opacity-60">
							{isPlaying ? "Playing" : "Ready"}
						</span>
					</div>
				</div>

				{/* Bottom Row: Scrubber */}
				<div
					ref={progressRef}
					className="relative w-full h-5 flex items-center group cursor-pointer"
					onMouseMove={handleHoverMove}
					onMouseEnter={() => setIsHovering(true)}
					onMouseLeave={() => setIsHovering(false)}
					onMouseDown={handleScrubberMouseDown}
				>
					{/* Tooltip */}
					<div
						className={clsx(
							"absolute bottom-full mb-3 px-2 py-1 rounded bg-black/80 text-[10px] font-mono text-white border border-white/10 pointer-events-none transition-opacity duration-200 backdrop-blur-sm z-30",
							isHovering ? "opacity-100" : "opacity-0",
						)}
						style={{
							left: `${duration > 0 ? (hoverTime / duration) * 100 : 0}%`,
							transform: "translateX(-50%)",
						}}
					>
						{formatTime(hoverTime)}
					</div>

					{/* Track Background */}
					<div className="absolute w-full h-[3px] bg-white/10 rounded-full overflow-hidden group-hover:h-[5px] transition-all">
						{/* Progress Fill - Gradient Brand */}
						<div
							className="h-full bg-[image:var(--gradient-brand)] shadow-[0_0_8px_var(--color-accent-primary)] transition-all duration-100 ease-linear"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>

					{/* Thumb Indicator */}
					<div
						className={clsx(
							"absolute h-3 w-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] ml-[-6px] pointer-events-none transition-all duration-100 ease-linear",
							isHovering || isDragging
								? "scale-100 opacity-100"
								: "scale-0 opacity-0",
						)}
						style={{ left: `${progressPercent}%` }}
					/>
				</div>
			</div>
		</div>
	);
}
