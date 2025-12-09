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
			className="h-14 flex items-center justify-between px-5 w-full shrink-0 z-50 relative border-b border-glass-border/30 bg-glass-surface/20"
		>
			{/* LEFT: Logo Section */}
			<div className="flex items-center justify-center gap-2 pointer-events-none opacity-90 select-none">
				<img src={logoIcon} alt="Scriberr" className="h-6 w-6 drop-shadow-md" />
				<div className="flex flex-col justify-center items-center h-full">
					<ScriberrTextLogo
						color="#ffffff"
						className="h-4 w-auto pointer-events-none"
					/>
				</div>
			</div>

			{/* CENTER: Stealth Navigation (The "Island") */}
			<nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-black/20 rounded-full p-1 border border-white/5 backdrop-blur-md shadow-inner">
				<NavTab
					icon={<Folder size={16} />}
					isActive={
						currentView === "recordings" || currentView === "transcription"
					}
					onClick={() => onViewChange("recordings")}
					label="Library"
				/>
				<NavTab
					icon={<Mic size={16} />}
					isActive={currentView === "recorder"}
					onClick={() => onViewChange("recorder")}
					label="Record"
				/>
				<NavTab
					icon={<Settings size={16} />}
					isActive={currentView === "settings"}
					onClick={() => onViewChange("settings")}
					label="Settings"
				/>
			</nav>

			{/* RIGHT: Window Controls */}
			<button
				onClick={closeWindow}
				className="text-white/40 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10 cursor-pointer active:scale-95 duration-200"
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
				"relative flex items-center justify-center px-3 py-1.5 rounded-full outline-none select-none cursor-pointer group",
				"transition-colors duration-300",
			)}
		>
			{/* 1. The Sliding Background Pill (Magic Motion) */}
			{/* layoutId ensures Framer Motion morphs this div from one button to another */}
			{isActive && (
				<motion.div
					layoutId="nav-pill"
					className="absolute inset-0 bg-white/10 border border-white/5 rounded-full shadow-[0_1px_8px_rgba(0,0,0,0.2)]"
					transition={{ type: "spring", stiffness: 300, damping: 30 }}
				/>
			)}

			{/* 2. Content Container (Z-Index to sit on top of the pill) */}
			<div className="relative flex items-center gap-2 z-10">
				{/* Icon */}
				<div
					className={clsx(
						"transition-colors duration-300",
						isActive
							? "text-accent-primary drop-shadow-[0_0_8px_rgba(255,140,0,0.6)]"
							: "text-stone-500 group-hover:text-stone-300",
					)}
				>
					{icon}
				</div>

				{/* Animated Label Reveal */}
				<motion.span
					initial={false}
					animate={{
						width: isActive ? "auto" : 0,
						opacity: isActive ? 1 : 0,
					}}
					transition={{ duration: 0.2, ease: "easeOut" }}
					className="overflow-hidden whitespace-nowrap text-[11px] font-medium tracking-wide text-stone-100"
				>
					{label}
				</motion.span>
			</div>
		</button>
	);
}
