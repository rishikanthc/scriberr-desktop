import { X, Folder, Mic, Settings } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion } from "framer-motion";
import logoIcon from "../../assets/scriberr-icon-cropped.png";
import { ScriberrTextLogo } from "./ScriberrTextLogo";
import clsx from "clsx";

type View = "recordings" | "settings" | "recorder" | "transcription";

interface TitleBarProps {
	onClose?: () => void;
	currentView: View;
	onViewChange: (view: View) => void;
}

export function TitleBar({
	onClose,
	currentView,
	onViewChange,
}: TitleBarProps) {
	const closeWindow = async () => {
		if (onClose) {
			onClose();
		} else {
			await getCurrentWindow().hide();
		}
	};

	return (
		<div
			data-tauri-drag-region
			className="h-16 flex items-center justify-between px-6 w-full shrink-0 z-50 relative bg-gradient-to-b from-white/5 to-transparent"
		>
			{/* LEFT: Logo Section (Brighter, crisp) */}
			<div className="flex items-center justify-center gap-3 pointer-events-none select-none">
				<img
					src={logoIcon}
					alt="Scriberr"
					className="h-6 w-6 drop-shadow-[0_0_10px_rgba(255,109,31,0.3)]"
				/>
				<div className="flex flex-col justify-center items-center h-full opacity-90">
					<ScriberrTextLogo
						color="var(--color-text-main)"
						className="h-3.5 w-auto pointer-events-none"
					/>
				</div>
			</div>

			{/* CENTER: Stealth Navigation (Level 3 Overlay - The "Island") */}
			<nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-[var(--color-glass-surface)]/80 rounded-full p-1.5 border border-[var(--color-glass-highlight)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
				<NavTab
					icon={<Folder size={18} />}
					isActive={
						currentView === "recordings" || currentView === "transcription"
					}
					onClick={() => onViewChange("recordings")}
					label="Library"
				/>
				<NavTab
					icon={<Mic size={18} />}
					isActive={currentView === "recorder"}
					onClick={() => onViewChange("recorder")}
					label="Record"
				/>
				<NavTab
					icon={<Settings size={18} />}
					isActive={currentView === "settings"}
					onClick={() => onViewChange("settings")}
					label="Settings"
				/>
			</nav>

			{/* RIGHT: Window Controls */}
			<button
				onClick={closeWindow}
				className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-white/10 transition-all p-2 rounded-lg active:scale-95 duration-200"
			>
				<X size={18} />
			</button>
		</div>
	);
}

// --- Animated Nav Tab Component ---

function NavTab({
	icon,
	isActive,
	onClick,
	label,
}: {
	icon: React.ReactNode;
	isActive: boolean;
	onClick: () => void;
	label: string;
}) {
	return (
		<button
			onClick={onClick}
			className={clsx(
				"relative flex items-center justify-center px-4 py-2 rounded-full outline-none select-none cursor-pointer group",
				"transition-all duration-300",
			)}
		>
			{/* 1. The Sliding Background Pill */}
			{isActive && (
				<motion.div
					layoutId="nav-pill"
					className="absolute inset-0 bg-white/10 border border-white/10 rounded-full shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
					transition={{ type: "spring", stiffness: 350, damping: 25 }}
				/>
			)}

			{/* 2. Content Container */}
			<div className="relative flex items-center gap-2 z-10">
				{/* Icon: Neutral when inactive, Electric when active */}
				<div
					className={clsx(
						"transition-all duration-300",
						isActive
							? "text-[var(--color-accent-text)] drop-shadow-[0_0_12px_var(--color-accent-glow)] scale-105"
							: "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)]",
					)}
				>
					{icon}
				</div>

				{/* Animated Label */}
				<motion.span
					initial={false}
					animate={{
						width: isActive ? "auto" : 0,
						opacity: isActive ? 1 : 0,
						marginLeft: isActive ? 4 : 0,
					}}
					transition={{ duration: 0.2, ease: "easeOut" }}
					className="overflow-hidden whitespace-nowrap text-[12px] font-semibold tracking-wide text-[var(--color-text-main)]"
				>
					{label}
				</motion.span>
			</div>
		</button>
	);
}
