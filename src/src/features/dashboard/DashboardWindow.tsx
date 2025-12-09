import { useState } from "react";
import { Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RecordingList } from "../library/RecordingList";
import { SettingsScreen } from "../settings/SettingsScreen";
import { RecorderScreen } from "../recorder/RecorderScreen";
import { TranscriptionView } from "../transcription/TranscriptionView";
import { TitleBar } from "../shell/TitleBar";

type View = "recordings" | "settings" | "recorder" | "transcription";

export function DashboardWindow() {
	const [currentView, setCurrentView] = useState<View>("recordings");
	const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(
		null,
	);

	const handleRecordingSelect = (id: string) => {
		setSelectedRecordingId(id);
		setCurrentView("transcription");
	};

	return (
		// LEVEL 0: The Base Layer (Solid Deep Stone)
		<div className="h-screen w-screen bg-[var(--color-glass-base)] text-[var(--color-text-main)] rounded-2xl border border-[var(--color-glass-border)] shadow-2xl overflow-hidden flex flex-col select-none relative font-sans antialiased selection:bg-[var(--color-accent-primary)] selection:text-white">
			{/* Unified TitleBar (Handles its own glass layering) */}
			<TitleBar currentView={currentView} onViewChange={setCurrentView} />

			{/* LEVEL 1: The Workspace Area */}
			{/* Added subtle inner highlight at top for depth */}
			<div className="flex-1 relative overflow-hidden p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]">
				<AnimatePresence mode="wait">
					{currentView === "recordings" ? (
						<FadeInView key="recordings">
							<RecordingList onSelect={handleRecordingSelect} />
						</FadeInView>
					) : currentView === "settings" ? (
						<FadeInView key="settings">
							<SettingsScreen onBack={() => setCurrentView("recordings")} />
						</FadeInView>
					) : currentView === "recorder" ? (
						<FadeInView key="recorder">
							<RecorderScreen />
						</FadeInView>
					) : (
						<FadeInView key="transcription">
							{selectedRecordingId && (
								<TranscriptionView recordingId={selectedRecordingId} />
							)}
						</FadeInView>
					)}
				</AnimatePresence>

				{/* Version Footer - Subtle "etched" look */}
				<div className="absolute bottom-4 left-6 opacity-30 hover:opacity-80 transition-opacity z-40 pointer-events-none">
					<p className="text-[10px] font-medium text-[var(--color-text-muted)] flex items-center gap-1.5 tracking-widest uppercase">
						<Sparkles size={10} />
						<span>v0.1.0</span>
					</p>
				</div>
			</div>
		</div>
	);
}

// Helper wrapper for consistent fade animations
function FadeInView({ children }: { children: React.ReactNode }) {
	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.99, y: 8 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.99, y: -8 }}
			transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }} // Apple-style easing
			className="h-full w-full"
		>
			{children}
		</motion.div>
	);
}
