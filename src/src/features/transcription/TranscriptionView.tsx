import { useState, useMemo } from 'react';
import { useRecordings } from '../library/api/useRecordings';
import { Loader2, AlignLeft, List, FileText, User } from 'lucide-react';
import { useProxyUrl } from '../audio/useProxyUrl';
import { EmberPlayer } from '../audio/EmberPlayer';
import clsx from 'clsx';

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
    return `${min}:${sec.toString().padStart(2, '0')} `;
};

export function TranscriptionView({ recordingId }: TranscriptionViewProps) {
    const { data: recordings = [] } = useRecordings();
    const recording = recordings.find(r => r.local_id === recordingId);

    // Audio Proxy URL
    const audioUrl = useProxyUrl(recording?.remote_job_id || undefined);

    // Derived state for safe text and segments
    const { text, segments } = useMemo(() => {
        if (!recording) return { text: '', segments: [] };

        let text = recording.transcript_text || "";
        let segments: TranscriptSegment[] = [];

        // Check if transcript_text is actually the JSON blob (Legacy/Sync issue mitigation)
        try {
            if (text.trim().startsWith('{')) {
                const parsed = JSON.parse(text);
                if (parsed.text && (parsed.segments || parsed.individual_transcripts)) { // Handle various structures if needed
                    text = parsed.text;
                    // Ideally use segments from here if available
                    if (Array.isArray(parsed.segments)) {
                        segments = parsed.segments;
                    }
                }
            }
        } catch (e) {
            // Not JSON, assume plain text
        }

        // Parse individual_transcripts_json if segments still empty
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

    const [viewMode, setViewMode] = useState<'paragraph' | 'segments'>(segments.length > 0 ? 'segments' : 'paragraph');

    // Auto-switch if segments available and user hasn't explicitly set mode? 
    // Kept simple: specific default initialization.

    if (!recording) {
        return (
            <div className="h-full w-full flex items-center justify-center text-white/40">
                <Loader2 className="animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col relative animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            {/* Header: Aligned with Content */}
            <div className="shrink-0 pb-4 pt-6 px-4 z-10 relative">
                <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
                    <div className="flex items-end justify-between">
                        {/* Title Group - Left Aligned */}
                        <div className="text-left">
                            <h1 className="text-lg font-bold font-display text-white tracking-tight drop-shadow-sm">
                                {recording.title || "Untitled Recording"}
                            </h1>
                            <div className="flex items-center gap-2 mt-0.5 opacity-40 text-[10px] font-medium text-stone-300 uppercase tracking-widest">
                                <span>{new Date(recording.created_at).toLocaleDateString()}</span>
                                {recording.duration_sec > 0 && (
                                    <>
                                        <span>•</span>
                                        <span>{formatTimestamp(recording.duration_sec)}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Compact Toggle Switch - Right Aligned */}
                        <div className="flex bg-glass-input rounded-full p-1 border border-white/5 shadow-sm backdrop-blur-md">
                            <button
                                onClick={() => setViewMode('paragraph')}
                                className={clsx(
                                    "p-1.5 rounded-full transition-all focus:outline-none cursor-pointer",
                                    viewMode === 'paragraph' ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/70"
                                )}
                                title="Paragraph View"
                            >
                                <AlignLeft size={14} />
                            </button>
                            <button
                                onClick={() => setViewMode('segments')}
                                disabled={segments.length === 0}
                                className={clsx(
                                    "p-1.5 rounded-full transition-all focus:outline-none cursor-pointer",
                                    viewMode === 'segments' ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/70",
                                    segments.length === 0 && "opacity-20 cursor-not-allowed"
                                )}
                                title="Segmented View"
                            >
                                <List size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Audio Player - Ember Equalizer */}
                    {audioUrl && (
                        <div className="w-full pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <EmberPlayer src={audioUrl} />
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area - Fixed viewport container */}
            <div className="flex-1 min-h-0 w-full flex justify-center pb-3 px-4">
                {/* The "Paper" - Fixed max-width, Flex Height */}
                <div className="w-full max-w-3xl bg-glass-paper border border-glass-border/30 rounded-lg shadow-lg backdrop-blur-xl flex flex-col relative overflow-hidden h-full">

                    {/* Inner Scroll Container */}
                    <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar scroll-smooth select-text">
                        {!text && !segments.length ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 gap-3 select-none">
                                <FileText size={40} className="text-stone-500" />
                                <p className="font-display text-sm font-medium text-stone-400">No transcription data available</p>
                            </div>
                        ) : (
                            <>
                                {viewMode === 'paragraph' ? (
                                    <div className="prose prose-invert prose-lg max-w-none">
                                        <p className="font-body text-[18px] leading-[1.65] tracking-wide text-stone-300 font-normal whitespace-pre-wrap">
                                            {text}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-6 font-body pb-4">
                                        {segments.map((segment, idx) => (
                                            <div key={idx} className="group flex gap-5 hover:bg-white/5 p-2.5 -mx-2.5 rounded-lg transition-colors duration-200">
                                                {/* Timestamp Column */}
                                                <div className="shrink-0 w-12 pt-1.5 select-none">
                                                    <div className="text-[10px] font-mono font-medium text-stone-500 group-hover:text-accent-primary/80 transition-colors bg-black/20 px-1.5 py-0.5 rounded w-fit">
                                                        {formatTimestamp(segment.start)}
                                                    </div>
                                                </div>

                                                {/* Content Column */}
                                                <div className="flex-1">
                                                    {segment.speaker && (
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-accent-primary mb-1.5 flex items-center gap-1.5 select-none opacity-80">
                                                            <User size={10} />
                                                            {segment.speaker}
                                                        </div>
                                                    )}
                                                    <p className="text-[18px] leading-[1.65] text-stone-300 group-hover:text-stone-100 transition-colors font-normal">
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

                    {/* Subtle fade at the bottom of the paper for scroll hint */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-glass-paper to-transparent pointer-events-none z-10" />
                </div>
            </div>
        </div>
    );
}
