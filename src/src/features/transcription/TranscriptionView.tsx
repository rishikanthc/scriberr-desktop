import { useState, useMemo } from "react";
import { useRecordings } from "../library/api/useRecordings";
import { Loader2, AlignLeft, List, FileText, User } from "lucide-react";
import { useProxyUrl } from "../audio/useProxyUrl";
import { EmberPlayer } from "../audio/EmberPlayer";
import clsx from "clsx";

interface TranscriptionViewProps {
	recordingId: string;
}

interface TranscriptSegment {
	start: number;
	end: number;
	text: string;
	speaker?: string;
}

const formatTimestamp = (seconds: number) => {
	const min = Math.floor(seconds / 60);
	const sec = Math.floor(seconds % 60);
	return `${min}:${sec.toString().padStart(2, "0")} `;
};

export function TranscriptionView({ recordingId }: TranscriptionViewProps) {
	const { data: recordings = [] } = useRecordings();
	const recording = recordings.find((r) => r.local_id === recordingId);

	// Audio Proxy URL
	const audioUrl = useProxyUrl(recording?.remote_job_id || undefined);

	// Derived state for safe text and segments
	const { text, segments } = useMemo(() => {
		if (!recording) return { text: "", segments: [] };

		let text = recording.transcript_text || "";
		let segments: TranscriptSegment[] = [];

		try {
			if (text.trim().startsWith("{")) {
				const parsed = JSON.parse(text);
				if (parsed.text) {
					text = parsed.text;
					if (Array.isArray(parsed.segments)) {
						segments = parsed.segments;
					}
				}
			}
		} catch (e) {
			/* Assume plain text */
		}

		if (recording.individual_transcripts_json && segments.length === 0) {
			try {
				const parsed = JSON.parse(recording.individual_transcripts_json);
				if (Array.isArray(parsed)) {
					segments = parsed as TranscriptSegment[];
				}
			} catch (e) {
				console.error("Failed to parse segments", e);
			}
		}

		return { text, segments };
	}, [recording]);

	const [viewMode, setViewMode] = useState<"paragraph" | "segments">(
		segments.length > 0 ? "segments" : "paragraph",
	);

	if (!recording) {
		return (
			<div className="h-full w-full flex items-center justify-center text-[var(--color-text-muted)]">
				<Loader2 className="animate-spin" />
			</div>
		);
	}

	return (
		<div className="h-full w-full flex flex-col relative animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
			{/* Header Section */}
			<div className="shrink-0 pb-6 pt-2 px-4 z-10 relative">
				<div className="w-full max-w-3xl mx-auto flex flex-col gap-5">
					<div className="flex items-end justify-between">
						{/* Title Group */}
						<div className="text-left">
							<h1 className="text-xl font-bold font-display text-[var(--color-text-main)] tracking-tight drop-shadow-sm">
								{recording.title || "Untitled Recording"}
							</h1>
							<div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest opacity-80">
								<span>
									{new Date(recording.created_at).toLocaleDateString()}
								</span>
								{recording.duration_sec > 0 && (
									<>
										<span className="opacity-50">•</span>
										<span>{formatTimestamp(recording.duration_sec)}</span>
									</>
								)}
							</div>
						</div>

						{/* View Toggle (Recessed Input Style) */}
						<div className="flex bg-[var(--color-glass-input)] rounded-lg p-1 border border-white/5 shadow-inner backdrop-blur-md">
							<button
								onClick={() => setViewMode("paragraph")}
								className={clsx(
									"p-1.5 rounded-md transition-all focus:outline-none cursor-pointer",
									viewMode === "paragraph"
										? "bg-[var(--color-glass-highlight)] text-white shadow-sm"
										: "text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]",
								)}
								title="Paragraph View"
							>
								<AlignLeft size={16} />
							</button>
							<button
								onClick={() => setViewMode("segments")}
								disabled={segments.length === 0}
								className={clsx(
									"p-1.5 rounded-md transition-all focus:outline-none cursor-pointer",
									viewMode === "segments"
										? "bg-[var(--color-glass-highlight)] text-white shadow-sm"
										: "text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]",
									segments.length === 0 && "opacity-30 cursor-not-allowed",
								)}
								title="Segmented View"
							>
								<List size={16} />
							</button>
						</div>
					</div>

					{/* Audio Player (Level 2 Card) */}
					{audioUrl && (
						<div className="w-full pt-1 animate-in slide-in-from-top-2 fade-in duration-500 delay-100">
							<EmberPlayer src={audioUrl} />
						</div>
					)}
				</div>
			</div>

			{/* Content Area - The "Paper" Layer (Level 3) */}
			<div className="flex-1 min-h-0 w-full flex justify-center pb-6 px-4">
				<div className="w-full max-w-3xl bg-[var(--color-glass-paper)] border border-[var(--color-glass-border)] rounded-xl shadow-2xl backdrop-blur-xl flex flex-col relative overflow-hidden h-full">
					{/* Glass Edge Highlight */}
					<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />

					{/* Inner Scroll Container */}
					<div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar scroll-smooth select-text">
						{!text && !segments.length ? (
							<div className="h-full flex flex-col items-center justify-center gap-4 select-none opacity-50">
								<div className="p-4 rounded-full bg-[var(--color-glass-surface)] border border-white/5">
									<FileText
										size={32}
										className="text-[var(--color-text-muted)]"
									/>
								</div>
								<p className="font-display text-sm font-medium text-[var(--color-text-muted)]">
									Transcription pending or empty
								</p>
							</div>
						) : (
							<>
								{viewMode === "paragraph" ? (
									<div className="prose prose-invert prose-lg max-w-none">
										<p className="font-body text-[17px] leading-[1.75] tracking-wide text-[var(--color-text-reading)] font-normal whitespace-pre-wrap">
											{text}
										</p>
									</div>
								) : (
									<div className="space-y-6 font-body pb-8">
										{segments.map((segment, idx) => (
											<div
												key={idx}
												className="group flex gap-6 hover:bg-white/[0.02] p-3 -mx-3 rounded-xl transition-colors duration-200 border border-transparent hover:border-white/5"
											>
												{/* Timestamp Column */}
												<div className="shrink-0 pt-1 select-none">
													<div className="text-[11px] font-mono font-medium text-[var(--color-text-muted)] opacity-60 group-hover:opacity-100 group-hover:text-[var(--color-accent-text)] transition-all">
														{formatTimestamp(segment.start)}
													</div>
												</div>

												{/* Content Column */}
												<div className="flex-1">
													{segment.speaker && (
														<div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-primary)] mb-1.5 flex items-center gap-1.5 select-none opacity-90">
															<User size={10} />
															{segment.speaker}
														</div>
													)}
													<p className="text-[17px] leading-[1.7] text-[var(--color-text-reading)] group-hover:text-[var(--color-text-main)] transition-colors font-normal">
														{segment.text}
													</p>
												</div>
											</div>
										))}
									</div>
								)}
							</>
						)}
					</div>

					{/* Bottom Fade - Visual cue for scrolling */}
					<div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--color-glass-paper)] to-transparent pointer-events-none z-10" />
				</div>
			</div>
		</div>
	);
}
