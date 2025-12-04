import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileAudio, CheckCircle, AlertCircle, Clock, Trash2, UploadCloud, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface LedgerEntry {
    local_id: string;
    remote_id: string | null;
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
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: string } | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

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

    // Close context menu on global click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();

        // Intelligent positioning to keep within window bounds
        const MENU_WIDTH = 130;
        const MENU_HEIGHT = 50;
        const PADDING = 10;

        const x = Math.min(e.clientX, window.innerWidth - MENU_WIDTH - PADDING);
        const y = Math.min(e.clientY, window.innerHeight - MENU_HEIGHT - PADDING);

        setContextMenu({ x, y, id });
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent closing immediately from global listener?
        // Actually global listener closes it, which is fine.
        // But we need to set deleteId.
        if (contextMenu) {
            setDeleteId(contextMenu.id);
            setContextMenu(null);
        }
    };

    const confirmDelete = async () => {
        if (deleteId) {
            try {
                await invoke('delete_recording_entry_command', { localId: deleteId });
                setRecordings(prev => prev.filter(r => r.local_id !== deleteId));
            } catch (error) {
                console.error('Failed to delete recording:', error);
            } finally {
                setDeleteId(null);
            }
        }
    };

    const handleUpload = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (uploadingId) return;

        setUploadingId(id);
        try {
            const updatedEntry = await invoke<LedgerEntry>('upload_recording_command', { localId: id });
            setRecordings(prev => prev.map(r => r.local_id === id ? updatedEntry : r));
        } catch (error) {
            console.error('Failed to upload recording:', error);
            // Refresh to get updated status (failed)
            fetchRecordings();
        } finally {
            setUploadingId(null);
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

    const getStatusDisplay = (status: string, id: string) => {
        if (uploadingId === id) {
            return <Loader2 size={14} className="text-blue-400 animate-spin" />;
        }

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
        <div className="flex flex-col h-full overflow-hidden relative">
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
                        key={rec.local_id}
                        onContextMenu={(e) => handleContextMenu(e, rec.local_id)}
                        className="group flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all cursor-default select-none relative"
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

                        <div className="shrink-0 relative w-5 h-5 flex items-center justify-center">
                            {/* Status Icon (visible by default, hidden on group hover if not uploaded/uploading) */}
                            <div className={clsx(
                                "transition-opacity duration-200",
                                (rec.upload_status !== 'uploaded' && uploadingId !== rec.local_id) && "group-hover:opacity-0"
                            )}>
                                {getStatusDisplay(rec.upload_status, rec.local_id)}
                            </div>

                            {/* Upload Button (hidden by default, visible on group hover if not uploaded/uploading) */}
                            {rec.upload_status !== 'uploaded' && uploadingId !== rec.local_id && (
                                <button
                                    onClick={(e) => handleUpload(e, rec.local_id)}
                                    className="absolute inset-0 flex items-center justify-center text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                    title="Upload to Scriberr"
                                >
                                    <UploadCloud size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-neutral-800 border border-white/10 rounded-lg shadow-xl py-1 min-w-[120px] backdrop-blur-md"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={handleDeleteClick}
                        className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/5 flex items-center gap-2 transition-colors"
                    >
                        <Trash2 size={14} />
                        Delete
                    </button>
                </div>
            )}

            {/* Confirmation Dialog */}
            {deleteId && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
                    <div className="bg-neutral-900 border border-white/10 rounded-xl p-4 w-full shadow-2xl flex flex-col gap-3">
                        <div className="text-center">
                            <h3 className="text-white font-medium text-sm">Delete Recording?</h3>
                            <p className="text-white/50 text-[10px] mt-1">This action cannot be undone.</p>
                        </div>
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="flex-1 bg-white/5 hover:bg-white/10 text-white/80 py-2 rounded-lg text-xs font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded-lg text-xs font-medium transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
