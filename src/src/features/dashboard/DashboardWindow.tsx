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
		<div className="h-screen w-screen bg-glass-base backdrop-blur-xl rounded-2xl border border-glass-border shadow-2xl overflow-hidden flex flex-col text-stone-200 select-none relative font-sans antialiased selection:bg-accent-primary/30">
			{/* Unified TitleBar with Navigation */}
			<TitleBar currentView={currentView} onViewChange={setCurrentView} />

			{/* Main Content Area */}
			{/* Added p-6 to prevent content from sticking to edges */}
			<div className="flex-1 relative overflow-hidden p-6">
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

				{/* Version Footer - Positioned comfortably inside the padding */}
				<div className="absolute bottom-4 left-6 opacity-20 hover:opacity-100 transition-opacity z-40 pointer-events-none">
					<p className="text-[10px] font-medium text-stone-500 flex items-center gap-1.5">
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
			initial={{ opacity: 0, scale: 0.98, y: 5 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.98, y: -5 }}
			transition={{ duration: 0.2, ease: "easeOut" }}
			className="h-full w-full"
		>
			{children}
		</motion.div>
	);
}
