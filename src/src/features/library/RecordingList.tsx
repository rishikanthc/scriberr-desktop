import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { FileAudio, Trash2, CloudUpload, CheckCircle, Clock, Calendar, AlertCircle, Loader2, RefreshCw, CloudOff } from 'lucide-react';
import { useRecordings, useDeleteRecording, useUploadRecording } from './api/useRecordings';
import { useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { LedgerEntry } from '../../types';

// Inline formatDuration if not exists
const formatDuration = (seconds?: number) => {
    if (!seconds) return '00:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
};

const getFilename = (path: string | null, title: string) => {
    if (path) return path.split(/[/\\]/).pop() || title;
    return title;
};

export function RecordingList() {
    const { data: recordings = [], isLoading, refetch } = useRecordings();
    const deleteMutation = useDeleteRecording();
    const uploadMutation = useUploadRecording();

    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: string } | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const queryClient = useQueryClient();

    // Virtualizer setup
    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: recordings.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 72, // Row height + gap
        overscan: 5,
    });

    useEffect(() => {
        const unlistenPromise = listen<LedgerEntry>('recording-added', (event) => {
            queryClient.setQueryData<LedgerEntry[]>(['recordings'], (old) => {
                if (!old) return [event.payload];
                if (old.some(r => r.local_id === event.payload.local_id)) return old;
                return [event.payload, ...old];
            });
        });

        const unlistenUpdatedPromise = listen<LedgerEntry>('recording-updated', (event) => {
            queryClient.setQueryData<LedgerEntry[]>(['recordings'], (old) => {
                if (!old) return old;
                return old.map(rec => rec.local_id === event.payload.local_id ? event.payload : rec);
            });
        });

        const unlistenDeletedPromise = listen<string>('recording-deleted-remote', (event) => {
            queryClient.setQueryData<LedgerEntry[]>(['recordings'], (old) => {
                if (!old) return old;
                return old.filter(rec => rec.remote_job_id !== event.payload);
            });
        });

        const unlistenSyncPromise = listen<void>('sync-completed', () => {
            refetch();
        });

        return () => {
            unlistenPromise.then(unlisten => unlisten());
            unlistenUpdatedPromise.then(unlisten => unlisten());
            unlistenDeletedPromise.then(unlisten => unlisten());
            unlistenSyncPromise.then(unlisten => unlisten());
        };
    }, [queryClient, refetch]);

    // Close context menu on global click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();

        const MENU_WIDTH = 130;
        const MENU_HEIGHT = 50;
        const PADDING = 10;

        const x = Math.min(e.clientX, window.innerWidth - MENU_WIDTH - PADDING);
        const y = Math.min(e.clientY, window.innerHeight - MENU_HEIGHT - PADDING);

        setContextMenu({ x, y, id });
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (contextMenu) {
            setDeleteId(contextMenu.id);
            setContextMenu(null);
        }
    };

    const confirmDelete = async () => {
        if (deleteId) {
            const rec = recordings.find(r => r.local_id === deleteId);
            if (!rec) {
                setDeleteId(null);
                return;
            }

            deleteMutation.mutate(rec.local_id, {
                onSuccess: () => setDeleteId(null),
                onError: (err) => console.error(err)
            });
        }
    };

    const handleUpload = async (id: string) => {
        if (uploadingId) return;

        setUploadingId(id);
        uploadMutation.mutate(id, {
            onSuccess: () => {
                setUploadingId(null);
            },
            onError: () => {
                setUploadingId(null);
                refetch();
            }
        });
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await invoke('sync_now_command');
            // Optimistic update or wait for event?
            // sync-completed event calls refetch.
        } catch (error) {
            console.error("Sync failed:", error);
        } finally {
            setIsSyncing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8 text-white/40">
                <Loader2 className="animate-spin" />
            </div>
        );
    }

    if (recordings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-white/40 gap-3">
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                        <span>Sync Now</span>
                    </button>
                </div>
                <FileAudio size={32} className="opacity-50" />
                <p>No recordings found</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden relative">
            <div className="flex items-center justify-between px-2 mb-2 shrink-0">
                <span className="text-xs font-medium text-white/60 uppercase tracking-wider">Recordings</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="text-white/40 hover:text-white transition-colors p-1"
                        title="Sync with Cloud"
                    >
                        <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => refetch()}
                        className="text-white/40 hover:text-white transition-colors p-1"
                        title="Reload List"
                    >
                        <Clock size={12} />
                    </button>
                </div>
            </div>

            <div
                ref={parentRef}
                className="h-full overflow-y-auto pr-2"
            >
                <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const rec = recordings[virtualRow.index];
                        const isDeleting = deleteMutation.isPending && deleteMutation.variables === rec.local_id;
                        const isUploading = uploadingId === rec.local_id;

                        return (
                            <div
                                key={rec.local_id}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                                className="pb-2"
                            >
                                <div
                                    onContextMenu={(e) => handleContextMenu(e, rec.local_id)}
                                    className="group flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all cursor-pointer select-none relative h-full"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-blue-500/20 flex items-center justify-center border border-white/10 shrink-0">
                                        <FileAudio size={16} className="text-white/80" />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-white/90 truncate">{getFilename(rec.local_file_path, rec.title)}</div>
                                        <div className="text-xs text-white/40 flex items-center gap-2 mt-0.5">
                                            <div className="flex items-center gap-1">
                                                <Calendar size={10} />
                                                <span>{new Date(rec.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className="w-0.5 h-0.5 rounded-full bg-white/20" />
                                            <div className="flex items-center gap-1">
                                                <Clock size={10} />
                                                <span>{formatDuration(rec.duration_sec)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {(isUploading || rec.sync_status === 'UPLOADING') && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#FF8C00]/10 border border-[#FF8C00]/20 text-[#FF8C00] text-[10px] font-medium animate-pulse">
                                                <CloudUpload size={10} />
                                                <span>Uploading...</span>
                                            </div>
                                        )}

                                        {rec.sync_status === 'PROCESSING_REMOTE' && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[10px] font-medium animate-pulse">
                                                <Loader2 size={10} className="animate-spin" />
                                                <span>Processing</span>
                                            </div>
                                        )}

                                        {rec.sync_status === 'COMPLETED_SYNCED' && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-200 text-[10px] font-medium">
                                                <CheckCircle size={10} />
                                                <span>Synced</span>
                                            </div>
                                        )}

                                        {rec.sync_status === 'FAILED' && !isUploading && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-200 text-[10px] font-medium">
                                                <AlertCircle size={10} />
                                                <span>Failed</span>
                                            </div>
                                        )}

                                        {rec.sync_status === 'DRAFT_READY' && !isUploading && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/40 text-[10px] font-medium">
                                                <CloudOff size={10} />
                                                <span>Not Uploaded</span>
                                            </div>
                                        )}

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteId(rec.local_id);
                                            }}
                                            disabled={isDeleting}
                                            className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                            title="Delete"
                                        >
                                            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                        </button>

                                        {rec.sync_status !== 'COMPLETED_SYNCED' && rec.sync_status !== 'PROCESSING_REMOTE' && !isUploading && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleUpload(rec.local_id);
                                                }}
                                                className="p-1.5 rounded-lg text-white/20 hover:text-blue-400 hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Upload to Scriberr"
                                            >
                                                <CloudUpload size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
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
