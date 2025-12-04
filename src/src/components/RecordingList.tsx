import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileAudio, CheckCircle, AlertCircle, Clock, Trash2 } from 'lucide-react';
import clsx from 'clsx';

interface LedgerEntry {
    id: string;
    file_path: string;
    upload_status: string;
    created_at: string;
    retry_count: number;
}

interface RecordingListProps {
    onSelect?: (entry: LedgerEntry) => void;
}

export function RecordingList({ onSelect }: RecordingListProps) {
    const [recordings, setRecordings] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchRecordings = async () => {
        setLoading(true);
        try {
            const result = await invoke<LedgerEntry[]>('get_recordings_command');
            setRecordings(result);
        } catch (error) {
            console.error('Failed to fetch recordings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecordings();
    }, []);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Confirm deletion? Maybe just do it for now as requested "right click to delete"
        // But right click usually opens context menu.
        // User said: "i should be able to right click on a recording to delete"
        // I'll implement a custom context menu or just delete on right click (with maybe a small confirmation or just immediate action).
        // Immediate action on right click is a bit aggressive but fits "simple".
        // Let's prevent default context menu and delete.

        try {
            await invoke('delete_recording_entry_command', { id });
            setRecordings(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            console.error('Failed to delete recording:', error);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'uploaded':
                return <CheckCircle size={14} className="text-green-400" />;
            case 'failed':
                return <AlertCircle size={14} className="text-red-400" />;
            default:
                return <div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />; // Or just a clock for pending?
            // "not uploaded and upload not attempted" -> incomplete
            // Let's use a Clock or CircleDashed
        }
    };

    const getStatusDisplay = (status: string) => {
        switch (status) {
            case 'uploaded':
                return <CheckCircle size={14} className="text-green-400" />;
            case 'failed':
                return <AlertCircle size={14} className="text-red-400" />;
            default: // incomplete
                return <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20" />;
        }
    };

    const getFilename = (path: string) => {
        return path.split(/[/\\]/).pop() || 'Unknown Recording';
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-2 mb-2 shrink-0">
                <span className="text-xs font-medium text-white/60 uppercase tracking-wider">Recordings</span>
                <button
                    onClick={fetchRecordings}
                    className="text-white/40 hover:text-white transition-colors"
                >
                    <Clock size={12} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex flex-col gap-1">
                {recordings.length === 0 && !loading && (
                    <div className="text-center py-8 text-white/30 text-xs">No recordings found</div>
                )}

                {recordings.map((rec) => (
                    <div
                        key={rec.id}
                        onContextMenu={(e) => handleDelete(rec.id, e)}
                        className="group flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all cursor-default select-none relative"
                        title="Right-click to delete"
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-blue-500/20 flex items-center justify-center border border-white/10 shrink-0">
                            <FileAudio size={16} className="text-white/80" />
                        </div>

                        <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                            <span className="text-sm font-medium text-white/90 truncate">{getFilename(rec.file_path)}</span>
                            <span className="text-[10px] text-white/40 truncate">
                                {new Date(rec.created_at).toLocaleDateString()} • {new Date(rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        <div className="shrink-0" title={rec.upload_status}>
                            {getStatusDisplay(rec.upload_status)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
