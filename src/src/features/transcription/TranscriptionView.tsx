
import { useState, useMemo } from 'react';
import { useRecordings } from '../library/api/useRecordings';
import { Loader2, AlignLeft, List, Clock, User, FileText } from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
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
    return `${min}:${sec.toString().padStart(2, '0')}`;
};

export function TranscriptionView({ recordingId }: TranscriptionViewProps) {
    const { data: recordings = [] } = useRecordings();
    const recording = recordings.find(r => r.local_id === recordingId);

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
        <div className="h-full w-full flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="shrink-0 pb-6 pt-2 px-8 flex items-center justify-between z-10">
                <div className="flex-1 text-center">
                    <h1 className="text-xl font-bold font-display text-white tracking-tight drop-shadow-md">
                        {recording.title || "Untitled Recording"}
                    </h1>
                    <div className="flex items-center justify-center gap-2 mt-1 opacity-50 text-xs font-medium text-stone-300">
                        <span>{new Date(recording.created_at).toLocaleDateString()}</span>
                        {recording.duration_sec > 0 && (
                            <>
                                <span>•</span>
                                <span>{formatTimestamp(recording.duration_sec)}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* View Toggle */}
                <div className="absolute right-8 top-4 flex bg-glass-input rounded-lg p-0.5 border border-white/10 shadow-lg backdrop-blur-md">
                    <Tooltip content="Paragraph View">
                        <button
                            onClick={() => setViewMode('paragraph')}
                            className={clsx(
                                "p-2 rounded-md transition-all",
                                viewMode === 'paragraph' ? "bg-white/15 text-white shadow-sm" : "text-white/40 hover:text-white/80"
                            )}
                        >
                            <AlignLeft size={16} />
                        </button>
                    </Tooltip>
                    <Tooltip content="Segmented View">
                        <button
                            onClick={() => setViewMode('segments')}
                            disabled={segments.length === 0}
                            className={clsx(
                                "p-2 rounded-md transition-all",
                                viewMode === 'segments' ? "bg-white/15 text-white shadow-sm" : "text-white/40 hover:text-white/80",
                                segments.length === 0 && "opacity-30 cursor-not-allowed"
                            )}
                        >
                            <List size={16} />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Scrollable Content Area - The "Paper" */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8 custom-scrollbar relative">
                <div className="max-w-3xl mx-auto min-h-full bg-glass-paper border border-glass-border/50 rounded-xl shadow-2xl backdrop-blur-xl p-8 md:p-12 relative overflow-hidden select-text">
                    {/* Paper Texture/Highlight */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />

                    {!text && !segments.length ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-4 select-none">
                            <FileText size={48} className="text-stone-500" />
                            <p className="font-display font-medium text-stone-400">No transcription data available</p>
                        </div>
                    ) : (
                        <>
                            {viewMode === 'paragraph' ? (
                                <div className="prose prose-invert prose-lg max-w-none text-stone-200/90 font-body leading-relaxed whitespace-pre-wrap tracking-wide">
                                    {text}
                                </div>
                            ) : (
                                <div className="space-y-6 font-body">
                                    {segments.map((segment, idx) => (
                                        <div key={idx} className="group flex gap-6 hover:bg-white/5 p-3 -mx-3 rounded-lg transition-colors">
                                            {/* Timestamp Column */}
                                            <div className="shrink-0 w-16 pt-1 select-none">
                                                <div className="text-xs font-mono text-stone-600 group-hover:text-accent-primary/80 transition-colors flex items-center gap-1.5 bg-black/20 px-1.5 py-0.5 rounded w-fit">
                                                    <Clock size={10} />
                                                    {formatTimestamp(segment.start)}
                                                </div>
                                            </div>

                                            {/* Content Column */}
                                            <div className="flex-1">
                                                {segment.speaker && (
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-accent-primary mb-1.5 flex items-center gap-1.5 select-none opacity-80 group-hover:opacity-100">
                                                        <User size={10} />
                                                        {segment.speaker}
                                                    </div>
                                                )}
                                                <p className="text-stone-200 text-lg leading-relaxed group-hover:text-white transition-colors">
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
            </div>

            {/* Fade overlay at bottom of paper to smooth scroll exit */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-glass-base via-glass-base/60 to-transparent pointer-events-none z-20" />
        </div>
    );
}
