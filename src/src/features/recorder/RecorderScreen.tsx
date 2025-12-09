import { useState, useEffect } from "react";
import { MicSelector } from "../recording/MicSelector";
import { Controls } from "../recording/components/Controls";
import { Timer } from "../recording/components/Timer";
import { useRecordingControls } from "../recording/api/useRecordingControls";
import { useMicrophones } from "../recording/api/useMicrophones";
import { useRecordingStatus } from "../recording/api/useRecordingStatus";
import { Mic, Pencil } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Visualizer } from "./Visualizer";
import { toast } from "sonner";

export function RecorderScreen() {
	// 1. Fetch Backend Status
	const { data: status, isLoading: isStatusLoading } = useRecordingStatus();

	// 2. Local controls
	const { startMutation, stopMutation, pauseMutation, resumeMutation } =
		useRecordingControls();

	const {
		data: mics = [],
		isLoading: isLoadingMics,
		switchMicMutation,
	} = useMicrophones();

	const [selectedMic, setSelectedMic] = useState<string>("");
	const [includeSystemAudio] = useState(true);
	const [filename, setFilename] = useState("");

	// Initial mic selection
	useEffect(() => {
		if (mics.length > 0 && !selectedMic) {
			setSelectedMic(mics[0].name);
		}
	}, [mics, selectedMic]);

	// Derived State
	const isRecording = status?.is_recording ?? false;
	const isPaused = status?.is_paused ?? false;
	const startTime = status?.start_time_ms ?? null;
	const isVisualizerActive = isRecording && !isPaused;

	const handleStart = () => {
		startMutation.mutate(
			{
				micDevice: selectedMic || undefined,
				captureSystemAudio: includeSystemAudio,
				filename: filename || undefined,
			},
			{
				onError: () => toast.error("Failed to start recording"),
			},
		);
	};

	const handleStop = () => {
		stopMutation.mutate(filename || undefined, {
			onSuccess: () => {
				toast.success("Recording saved", {
					description: filename
						? `Saved as ${filename}.wav`
						: "Saved successfully",
				});
				setFilename("");
			},
			onError: () => toast.error("Failed to save recording"),
		});
	};

	if (isStatusLoading) return null;

	return (
		<div className="flex flex-col h-full items-center justify-between p-8 relative select-none overflow-hidden">
			{/* Top Section - Filename Input (Recessed Level 4) */}
			<div className="w-full flex justify-center h-20 items-center z-20">
				<div className="relative group w-80">
					<input
						type="text"
						placeholder="Untitled Recording"
						value={filename}
						onChange={(e) => setFilename(e.target.value)}
						className="w-full bg-[var(--color-glass-input)] border border-transparent text-[var(--color-text-main)] placeholder:text-[var(--color-text-disabled)] text-center rounded-xl px-10 py-3 transition-all duration-300 outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] focus:border-[var(--color-accent-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)]/50"
					/>
					<Pencil
						size={14}
						className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-disabled)] pointer-events-none group-focus-within:text-[var(--color-accent-text)] transition-colors"
					/>
				</div>
			</div>

			{/* Center Section: Visualizer OR Start Button */}
			<div className="flex-1 flex items-center justify-center w-full relative">
				<AnimatePresence mode="wait">
					{isRecording ? (
						<motion.div
							key="recording-hero"
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.9 }}
							className="relative w-full max-w-2xl h-80 flex items-center justify-center"
						>
							{/* Visualizer Background - Absolute */}
							<div className="absolute inset-0 z-0">
								<Visualizer isActive={isVisualizerActive} />
							</div>

							{/* Timer - Center Overlay (Floating Card) */}
							<div className="z-10 relative">
								<Timer
									startTime={startTime}
									isActive={isVisualizerActive}
									isPaused={isPaused}
								/>
							</div>
						</motion.div>
					) : (
						<motion.div
							key="idle-hero"
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.95 }}
							className="relative flex items-center justify-center p-12"
						>
							{/* Start Recording Button (The Jewel) */}
							<button
								onClick={handleStart}
								className="group relative w-28 h-28 flex items-center justify-center rounded-full transition-transform duration-300 hover:scale-105 active:scale-95 focus:outline-none outline-none ring-0 cursor-pointer"
							>
								{/* Outer Glow Ring */}
								<div className="absolute inset-0 rounded-full border border-[var(--color-accent-primary)]/30 group-hover:border-[var(--color-accent-primary)]/60 transition-colors shadow-[0_0_30px_var(--color-accent-glow)] opacity-50" />

								{/* Inner Circle (The Button) */}
								<div className="w-24 h-24 rounded-full bg-[image:var(--gradient-brand)] flex items-center justify-center transition-all duration-300 shadow-[0_0_20px_var(--color-accent-glow)] hover:brightness-110">
									<Mic className="text-white w-10 h-10 drop-shadow-md group-hover:scale-110 transition-transform duration-300" />
								</div>
							</button>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* Bottom Section: Controls & Mic */}
			<div className="w-full max-w-sm flex flex-col items-center gap-6 z-20 pb-8">
				{/* Main Controls - Centered - ONLY SHOW WHEN RECORDING */}
				<div className="h-20 flex items-center justify-center">
					<AnimatePresence>
						{isRecording && (
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: 10 }}
							>
								<Controls
									isRecording={isRecording}
									isPaused={isPaused}
									onStart={handleStart}
									onStop={handleStop}
									onPause={() => pauseMutation.mutate()}
									onResume={() => resumeMutation.mutate()}
									disabled={false}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				{/* Mic Selector & Info */}
				<div className="w-full flex flex-col gap-3">
					<MicSelector
						devices={mics.map((m) => ({ deviceId: m.name, label: m.name }))}
						selectedDevice={selectedMic}
						onSelect={(mic) => {
							setSelectedMic(mic);
							if (isRecording) {
								switchMicMutation.mutate(mic);
							}
						}}
						isLoading={isLoadingMics}
						disabled={isRecording}
					/>

					{/* System Audio Text Indicator */}
					<div className="text-center">
						<span className="text-[var(--color-text-disabled)] text-[10px] uppercase tracking-widest font-semibold flex items-center justify-center gap-2 opacity-60">
							<span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span>
							System Audio Active
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
