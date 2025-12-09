import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Mic } from "lucide-react";
import clsx from "clsx";

interface MicSelectorProps {
	devices: { deviceId: string; label: string }[];
	selectedDevice: string;
	onSelect: (deviceId: string) => void;
	disabled?: boolean;
	isLoading?: boolean;
}

export function MicSelector({
	devices,
	selectedDevice,
	onSelect,
	disabled = false,
	isLoading = false,
}: MicSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);

	const handleSelect = (id: string) => {
		onSelect(id);
		setIsOpen(false);
	};

	const selectedLabel =
		devices.find((d) => d.deviceId === selectedDevice)?.label ||
		"Select Microphone";

	return (
		<div className="relative w-full z-50">
			{/* Trigger Button - Level 2 Surface */}
			<button
				onClick={() => !disabled && setIsOpen(!isOpen)}
				disabled={disabled}
				className={clsx(
					"w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-all shadow-lg backdrop-blur-xl border cursor-pointer",
					disabled
						? "opacity-50 cursor-not-allowed bg-[var(--color-glass-surface)] border-transparent"
						: "bg-[var(--color-glass-surface)] border-[var(--color-glass-border)] hover:bg-[var(--color-glass-paper)] hover:border-[var(--color-glass-highlight)]",
				)}
			>
				<div className="flex items-center gap-3 truncate">
					<Mic
						size={16}
						className={clsx(
							disabled
								? "text-[var(--color-text-disabled)]"
								: "text-[var(--color-accent-primary)]",
						)}
					/>
					<span
						className={clsx(
							"truncate font-medium",
							disabled
								? "text-[var(--color-text-disabled)]"
								: "text-[var(--color-text-main)]",
						)}
					>
						{isLoading ? "Loading devices..." : selectedLabel}
					</span>
				</div>
				<ChevronDown
					size={16}
					className={clsx(
						"transition-transform duration-300",
						disabled
							? "text-[var(--color-text-disabled)]"
							: "text-[var(--color-text-muted)]",
						isOpen ? "rotate-180" : "",
					)}
				/>
			</button>

			{/* Dropdown Menu - Level 3 Overlay */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0, y: -8, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -8, scale: 0.98 }}
						transition={{ duration: 0.15 }}
						className="absolute bottom-full mb-2 w-full bg-[var(--color-glass-paper)] border border-[var(--color-glass-highlight)] rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto backdrop-blur-2xl"
					>
						<div className="p-1.5 flex flex-col gap-0.5">
							{devices.map((mic) => {
								const isSelected = selectedDevice === mic.deviceId;
								return (
									<button
										key={mic.deviceId}
										onClick={() => handleSelect(mic.deviceId)}
										className={clsx(
											"w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center justify-between group",
											isSelected
												? "bg-[var(--color-surface-tint)] text-[var(--color-text-main)]"
												: "text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text-main)]",
										)}
									>
										<span className="truncate pr-4">{mic.label}</span>
										{isSelected && (
											<Check
												size={14}
												className="text-[var(--color-accent-primary)] shrink-0"
											/>
										)}
									</button>
								);
							})}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
