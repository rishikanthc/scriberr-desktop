import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { Monitor, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

interface RunnableApp {
    id: string;
    pid: number;
    name: string;
    icon: number[];
}

interface AppSelectorProps {
    onSelect: (pid: number) => void;
    selectedPid: number | null;
    disabled: boolean;
}

export function AppSelector({ onSelect, selectedPid, disabled }: AppSelectorProps) {
    const [apps, setApps] = useState<RunnableApp[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchApps = async () => {
        setLoading(true);
        try {
            const result = await invoke<RunnableApp[]>('get_apps');
            setApps(result);
        } catch (error) {
            console.error('Failed to fetch apps:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApps();
    }, []);

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between px-2">
                <span className="text-xs font-medium text-white/60 uppercase tracking-wider">Select App</span>
                <button
                    onClick={fetchApps}
                    disabled={loading || disabled}
                    className="text-white/40 hover:text-white transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
                </button>
            </div>

            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {apps.length === 0 && !loading && (
                    <div className="text-center py-4 text-white/30 text-sm">No meeting apps found</div>
                )}

                {apps.map((app) => (
                    <motion.button
                        key={app.pid}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => onSelect(app.pid)}
                        disabled={disabled}
                        className={clsx(
                            "flex items-center gap-3 p-3 rounded-xl text-left transition-all border",
                            selectedPid === app.pid
                                ? "bg-white/10 border-white/20 shadow-lg backdrop-blur-md ring-1 ring-white/10"
                                : "bg-transparent border-transparent hover:bg-white/5 text-white/60 hover:text-white"
                        )}
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                            <Monitor size={16} className="text-white/80" />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium truncate">{app.name}</span>
                            <span className="text-[10px] text-white/40">PID: {app.pid}</span>
                        </div>
                    </motion.button>
                ))}
            </div>
        </div>
    );
}
