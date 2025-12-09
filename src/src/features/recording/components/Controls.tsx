import { Mic, Square, Pause, Play } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

interface ControlsProps {
	isRecording: boolean;
	isPaused: boolean;
	onStart: () => void;
	onStop: () => void;
	onPause: () => void;
	onResume: () => void;
	disabled: boolean;
}

export function Controls({
	isRecording,
	isPaused,
	onStart,
	onStop,
	onPause,
	onResume,
	disabled,
}: ControlsProps) {
	return (
		<div className="flex justify-center items-center gap-6">
			{!isRecording ? (
				/* Note: This state is mostly handled by parent Hero, but keeping for safety */
				<motion.button
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					onClick={onStart}
					disabled={disabled}
					className={clsx(
						"w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all",
						disabled
							? "bg-white/5 cursor-not-allowed opacity-30"
							: "bg-[image:var(--gradient-brand)] text-white shadow-[0_0_15px_var(--color-accent-glow)]",
					)}
				>
					<Mic size={24} fill="currentColor" />
				</motion.button>
			) : (
				<>
					{/* Pause / Resume - Ghost Button */}
					<motion.button
						whileHover={{
							scale: 1.05,
							backgroundColor: "rgba(255,255,255,0.08)",
						}}
						whileTap={{ scale: 0.95 }}
						onClick={isPaused ? onResume : onPause}
						className="w-14 h-14 rounded-full bg-[var(--color-glass-surface)] border border-[var(--color-glass-border)] flex items-center justify-center text-[var(--color-text-main)] shadow-lg backdrop-blur-md cursor-pointer transition-colors"
						title={isPaused ? "Resume Recording" : "Pause Recording"}
					>
						{isPaused ? (
							<Play size={20} fill="currentColor" className="ml-0.5" />
						) : (
							<Pause size={20} fill="currentColor" />
						)}
					</motion.button>

					{/* Stop Button - Primary Destructive Action */}
					<motion.button
						whileHover={{
							scale: 1.05,
							backgroundColor: "rgba(255,255,255,0.15)",
						}}
						whileTap={{ scale: 0.95 }}
						onClick={onStop}
						className="w-20 h-20 rounded-full bg-[var(--color-glass-paper)] border border-[var(--color-glass-highlight)] flex items-center justify-center text-[var(--color-text-main)] shadow-[0_0_20px_rgba(0,0,0,0.3)] backdrop-blur-xl cursor-pointer transition-colors group"
						title="Stop and Save"
					>
						<div className="w-8 h-8 rounded-md bg-white group-hover:bg-red-500 transition-colors shadow-sm" />
					</motion.button>
				</>
			)}
		</div>
	);
}
