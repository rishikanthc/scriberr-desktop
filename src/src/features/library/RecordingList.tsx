import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import clsx from "clsx"; // Ensure you have this installed, or use standard string concatenation
import {
	FileAudio,
	Trash2,
	CloudUpload,
	CheckCircle,
	Clock,
	Calendar,
	AlertCircle,
	Loader2,
	RefreshCw,
	CloudOff,
	CircleDashed,
} from "lucide-react";
import {
	useRecordings,
	useDeleteRecording,
	useUploadRecording,
} from "./api/useRecordings";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Tooltip } from "../../components/ui/Tooltip";
import type { LedgerEntry } from "../../types";

// Inline formatDuration if not exists
const formatDuration = (seconds?: number) => {
	if (!seconds) return "00:00";
	const min = Math.floor(seconds / 60);
	const sec = Math.floor(seconds % 60);
	return `${min}:${sec.toString().padStart(2, "0")}`;
};

const getFilename = (path: string | null, title: string) => {
	if (path) return path.split(/[/\\]/).pop() || title;
	return title;
};

interface RecordingListProps {
	onSelect?: (id: string) => void;
}

export function RecordingList({ onSelect }: RecordingListProps) {
	const { data: recordings = [], isLoading, refetch } = useRecordings();
	const deleteMutation = useDeleteRecording();
	const uploadMutation = useUploadRecording();

	const [uploadingId, setUploadingId] = useState<string | null>(null);
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		id: string;
	} | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [isSyncing, setIsSyncing] = useState(false);
	const queryClient = useQueryClient();

	// Virtualizer setup
	const parentRef = useRef<HTMLDivElement>(null);
	const rowVirtualizer = useVirtualizer({
		count: recordings.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 80, // Increased slightly to account for padding/borders
		overscan: 5,
	});

	useEffect(() => {
		const unlistenPromise = listen<LedgerEntry>("recording-added", (event) => {
			queryClient.setQueryData<LedgerEntry[]>(["recordings"], (old) => {
				if (!old) return [event.payload];
				if (old.some((r) => r.local_id === event.payload.local_id)) return old;
				return [event.payload, ...old];
			});
		});

		const unlistenUpdatedPromise = listen<LedgerEntry>(
			"recording-updated",
			(event) => {
				queryClient.setQueryData<LedgerEntry[]>(["recordings"], (old) => {
					if (!old) return old;
					return old.map((rec) =>
						rec.local_id === event.payload.local_id ? event.payload : rec,
					);
				});
			},
		);

		const unlistenDeletedPromise = listen<string>(
			"recording-deleted-remote",
			(event) => {
				queryClient.setQueryData<LedgerEntry[]>(["recordings"], (old) => {
					if (!old) return old;
					return old.filter((rec) => rec.remote_job_id !== event.payload);
				});
			},
		);

		const unlistenSyncPromise = listen<void>("sync-completed", () => {
			refetch();
		});

		return () => {
			unlistenPromise.then((unlisten) => unlisten());
			unlistenUpdatedPromise.then((unlisten) => unlisten());
			unlistenDeletedPromise.then((unlisten) => unlisten());
			unlistenSyncPromise.then((unlisten) => unlisten());
		};
	}, [queryClient, refetch]);

	// Close context menu on global click
	useEffect(() => {
		const handleClick = () => setContextMenu(null);
		window.addEventListener("click", handleClick);
		return () => window.removeEventListener("click", handleClick);
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
			const rec = recordings.find((r) => r.local_id === deleteId);
			if (!rec) {
				setDeleteId(null);
				return;
			}

			deleteMutation.mutate(rec.local_id, {
				onSuccess: () => setDeleteId(null),
				onError: (err) => console.error(err),
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
			},
		});
	};

	const handleSync = async () => {
		setIsSyncing(true);
		try {
			await invoke("sync_now_command");
		} catch (error) {
			console.error("Sync failed:", error);
		} finally {
			setIsSyncing(false);
		}
	};

	// --- Loading State ---
	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full p-8 text-[var(--color-text-muted)]">
				<Loader2 className="animate-spin" />
			</div>
		);
	}

	// --- Empty State ---
	if (recordings.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8 text-[var(--color-text-muted)] gap-4">
				<div className="p-4 rounded-full bg-[var(--color-glass-surface)] border border-[var(--color-glass-border)] shadow-xl">
					<FileAudio size={32} className="opacity-40" />
				</div>
				<div className="flex flex-col items-center gap-1">
					<p className="font-medium text-[var(--color-text-main)]">
						No recordings found
					</p>
					<p className="text-xs text-[var(--color-text-muted)] opacity-60">
						Sync to fetch from cloud
					</p>
				</div>
				<div className="flex gap-2 mt-2">
					<Tooltip content="Sync with Cloud">
						<button
							onClick={handleSync}
							disabled={isSyncing}
							className="bg-[var(--color-glass-surface)] hover:bg-[var(--color-glass-highlight)] border border-[var(--color-glass-border)] px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-all disabled:opacity-50"
						>
							<RefreshCw
								size={12}
								className={isSyncing ? "animate-spin" : ""}
							/>
							<span>Sync Now</span>
						</button>
					</Tooltip>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full overflow-hidden relative">
			{/* Header / Stats */}
			<div className="flex items-center justify-between px-2 mb-3 shrink-0">
				<span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
					Recordings ({recordings.length})
				</span>
				<div className="flex items-center gap-1">
					<Tooltip content="Sync with Cloud">
						<button
							onClick={handleSync}
							disabled={isSyncing}
							className="text-[var(--color-text-muted)] hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5"
						>
							<RefreshCw
								size={12}
								className={isSyncing ? "animate-spin" : ""}
							/>
						</button>
					</Tooltip>
				</div>
			</div>

			{/* The List Container */}
			<div
				ref={parentRef}
				className="h-full overflow-y-auto pr-2 scrollbar-hide"
			>
				<div
					style={{
						height: `${rowVirtualizer.getTotalSize()}px`,
						width: "100%",
						position: "relative",
					}}
				>
					{rowVirtualizer.getVirtualItems().map((virtualRow) => {
						const rec = recordings[virtualRow.index];
						const isDeleting =
							deleteMutation.isPending &&
							deleteMutation.variables === rec.local_id;
						const isUploading = uploadingId === rec.local_id;

						return (
							<div
								key={rec.local_id}
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									width: "100%",
									height: `${virtualRow.size}px`,
									transform: `translateY(${virtualRow.start}px)`,
								}}
								className="pb-3" // Gap between items
							>
								<div
									onContextMenu={(e) => handleContextMenu(e, rec.local_id)}
									onClick={() => onSelect?.(rec.local_id)}
									className={clsx(
										// Level 2 Card Style
										"group flex items-center gap-4 p-3 rounded-xl transition-all cursor-pointer select-none relative h-full",
										"bg-[var(--color-glass-surface)] border border-[var(--color-glass-border)]",
										"hover:bg-[var(--color-glass-paper)] hover:border-[var(--color-glass-highlight)]",
										// Top edge highlight for glass effect
										"shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
									)}
								>
									{/* Icon Container (Surface Approach - Neutral) */}
									<div className="w-10 h-10 rounded-lg bg-[var(--color-glass-input)] border border-white/5 flex items-center justify-center shrink-0">
										<FileAudio
											size={18}
											className="text-zinc-500 group-hover:text-zinc-400 transition-colors"
										/>
									</div>

									{/* File Details */}
									<div className="min-w-0 flex-1 flex flex-col justify-center">
										<div className="text-sm font-medium text-[var(--color-text-main)] truncate">
											{getFilename(rec.local_file_path, rec.title)}
										</div>
										<div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-3 mt-0.5">
											<div className="flex items-center gap-1.5 opacity-80">
												<Calendar size={10} />
												<span>
													{new Date(rec.created_at).toLocaleDateString()}
												</span>
											</div>
											<div className="w-0.5 h-0.5 rounded-full bg-[var(--color-text-disabled)]" />
											<div className="flex items-center gap-1.5 opacity-80">
												<Clock size={10} />
												<span>{formatDuration(rec.duration_sec)}</span>
											</div>
										</div>
									</div>

									{/* Status & Actions Area */}
									<div className="flex items-center gap-1">
										{/* Status Icons - Using Electric Ember & Success Colors */}
										{(isUploading || rec.sync_status === "UPLOADING") && (
											<Tooltip content="Uploading...">
												<div className="p-1.5 rounded-md text-[var(--color-accent-text)] animate-pulse">
													<CloudUpload size={16} />
												</div>
											</Tooltip>
										)}

										{rec.sync_status === "REMOTE_PENDING" && (
											<Tooltip content="Pending Transcription">
												<div className="p-1.5 rounded-md text-sky-400/80">
													<CircleDashed size={16} />
												</div>
											</Tooltip>
										)}

										{rec.sync_status === "PROCESSING_REMOTE" && (
											<Tooltip content="Processing remotely...">
												<div className="p-1.5 rounded-md text-[var(--color-accent-primary)] animate-pulse">
													<Loader2 size={16} className="animate-spin" />
												</div>
											</Tooltip>
										)}

										{rec.sync_status === "COMPLETED_SYNCED" && (
											<Tooltip content="Synced">
												<div className="p-1.5 rounded-md text-emerald-500">
													<CheckCircle size={16} />
												</div>
											</Tooltip>
										)}

										{rec.sync_status === "FAILED" && !isUploading && (
											<Tooltip content="Sync Failed">
												<div className="p-1.5 rounded-md text-red-400">
													<AlertCircle size={16} />
												</div>
											</Tooltip>
										)}

										{rec.sync_status === "DRAFT_READY" && !isUploading && (
											<Tooltip content="Not Uploaded (Local Only)">
												<div className="p-1.5 rounded-md text-[var(--color-text-disabled)] opacity-50">
													<CloudOff size={16} />
												</div>
											</Tooltip>
										)}

										{/* Hover Actions (Ghost) */}
										<Tooltip content="Delete">
											<button
												onClick={(e) => {
													e.stopPropagation();
													setDeleteId(rec.local_id);
												}}
												disabled={isDeleting}
												className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 ml-1"
											>
												{isDeleting ? (
													<Loader2 size={14} className="animate-spin" />
												) : (
													<Trash2 size={14} />
												)}
											</button>
										</Tooltip>

										{/* Upload Button - ONLY for DRAFT_READY */}
										{rec.sync_status === "DRAFT_READY" && !isUploading && (
											<Tooltip content="Upload to Scriberr">
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleUpload(rec.local_id);
													}}
													className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-blue-400 hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
												>
													<CloudUpload size={14} />
												</button>
											</Tooltip>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Context Menu (Overlay Level 3) */}
			{contextMenu && (
				<div
					className="fixed z-50 bg-[var(--color-glass-paper)] border border-[var(--color-glass-highlight)] rounded-xl shadow-2xl py-1.5 min-w-[140px] backdrop-blur-xl"
					style={{ top: contextMenu.y, left: contextMenu.x }}
					onClick={(e) => e.stopPropagation()}
				>
					<button
						onClick={handleDeleteClick}
						className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-white/5 flex items-center gap-2 transition-colors font-medium"
					>
						<Trash2 size={14} />
						Delete File
					</button>
				</div>
			)}

			{/* Confirmation Dialog (Overlay Level 3) */}
			{deleteId && (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
					<div className="bg-[var(--color-glass-surface)] border border-[var(--color-glass-highlight)] rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4">
						<div className="text-center">
							<h3 className="text-[var(--color-text-main)] font-semibold text-sm">
								Delete Recording?
							</h3>
							<p className="text-[var(--color-text-muted)] text-xs mt-1 leading-relaxed">
								This action cannot be undone. The file will be permanently
								removed.
							</p>
						</div>
						<div className="flex gap-3 mt-2">
							<button
								onClick={() => setDeleteId(null)}
								className="flex-1 bg-white/5 hover:bg-white/10 text-[var(--color-text-main)] py-2.5 rounded-lg text-xs font-medium transition-colors border border-transparent"
							>
								Cancel
							</button>
							<button
								onClick={confirmDelete}
								className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 py-2.5 rounded-lg text-xs font-medium transition-colors"
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
