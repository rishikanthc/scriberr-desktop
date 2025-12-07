import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { open } from '@tauri-apps/plugin-dialog';
import { Sparkles, Server, Folder, Check, AlertCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface SettingsScreenProps {
    onBack: () => void;
}

import { useSettings, useSaveSettings, useTestConnection } from './api/useSettings';

export function SettingsScreen({ onBack }: SettingsScreenProps) {
    const { data: settings, isLoading } = useSettings();
    const saveMutation = useSaveSettings();
    const testConnectionMutation = useTestConnection();

    // Local state for form editing
    const [url, setUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [outputPath, setOutputPath] = useState('');

    // Status state
    const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error' | 'saving'>('idle');
    const [message, setMessage] = useState('');

    // Initialize state
    useEffect(() => {
        if (settings) {
            setUrl(settings.scriberr_url);
            setApiKey(settings.api_key);
            setOutputPath(settings.output_path);
        }
    }, [settings]);

    // Dirty state detection
    const isDirty = settings ? (
        url !== settings.scriberr_url ||
        apiKey !== settings.api_key ||
        outputPath !== settings.output_path
    ) : false;

    const validateUrl = (value: string) => {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    };

    const handleBrowse = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                defaultPath: outputPath || undefined,
            });

            if (selected && typeof selected === 'string') {
                setOutputPath(selected);
                setStatus('idle');
                setMessage('');
            }
        } catch (err) {
            console.error("Failed to pick folder:", err);
        }
    };

    const handleTestConnection = async () => {
        if (!url || !apiKey) {
            setStatus('error');
            setMessage('Missing credentials');
            return;
        }

        if (!validateUrl(url)) {
            setStatus('error');
            setMessage('Invalid URL');
            return;
        }

        setStatus('testing');
        setMessage('Testing connection...');

        testConnectionMutation.mutate({ url, apiKey }, {
            onSuccess: (success) => {
                if (success) {
                    setStatus('success');
                    setMessage('Connection verified');
                } else {
                    setStatus('error');
                    setMessage('Connection failed');
                }
            },
            onError: () => {
                setStatus('error');
                setMessage('Network error');
            }
        });
    };

    const handleSave = async () => {
        if (!isDirty) return;

        if (!url || !apiKey || !outputPath) {
            setStatus('error');
            setMessage('Missing fields');
            return;
        }

        if (!validateUrl(url)) {
            setStatus('error');
            setMessage('Invalid URL');
            return;
        }

        setStatus('saving');
        setMessage('Saving settings...');

        saveMutation.mutate({ scriberr_url: url, api_key: apiKey, output_path: outputPath }, {
            onSuccess: () => {
                setStatus('success');
                setMessage('Settings saved');
            },
            onError: (error) => {
                setStatus('error');
                setMessage(`Save failed: ${error}`);
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full text-white/40">
                <Loader2 className="animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden px-4">
            {/* Header: H1, SemiBold, -2% tracking */}
            <div className="flex items-center justify-between mb-8 pt-6 shrink-0">
                <h1 className="text-[28px] font-semibold text-white tracking-tight leading-none drop-shadow-md">Settings</h1>

                <button
                    onClick={handleSave}
                    disabled={!isDirty || status === 'saving'}
                    className={clsx(
                        "p-2.5 rounded-full transition-all duration-300 relative group border",
                        isDirty
                            ? "bg-orange-500 border-orange-400 text-white shadow-[0_0_15px_rgba(255,140,0,0.3)] hover:bg-[#FF9F2D] hover:shadow-[0_0_20px_rgba(255,140,0,0.5)] active:scale-95"
                            : "bg-white/5 border-white/10 text-white/20 cursor-not-allowed"
                    )}
                    title={isDirty ? "Save Changes" : "No changes to save"}
                >
                    {status === 'saving' || status === 'testing' ? (
                        <Loader2 size={20} className="animate-spin" />
                    ) : (
                        <Check size={20} strokeWidth={3} />
                    )}
                </button>
            </div>

            <div className="flex-1 flex flex-col gap-6 overflow-y-auto min-h-0 pb-6 scrollbar-hide">

                {/* Connection Card */}
                <div className="bg-stone-800/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        {/* H3/Section Label */}
                        <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Connection</label>

                        {/* Status/Test Indicator */}
                        <div className="flex items-center gap-3">
                            {/* Status Text: UI Body/Micro */}
                            <AnimatePresence mode="wait">
                                {status !== 'idle' && (
                                    <motion.span
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={clsx(
                                            "text-xs font-semibold tracking-wide",
                                            status === 'success' && "text-emerald-400",
                                            status === 'error' && "text-red-400",
                                            (status === 'testing' || status === 'saving') && "text-blue-400"
                                        )}
                                    >
                                        {message}
                                    </motion.span>
                                )}
                            </AnimatePresence>

                            {/* Test Button - Icon Only */}
                            <button
                                onClick={handleTestConnection}
                                disabled={status === 'testing' || !url || !apiKey}
                                className="text-stone-400 hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed p-1"
                                title="Test Network Connection"
                            >
                                <Server size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        {/* URL Input */}
                        <div className="group relative">
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5 block group-focus-within:text-orange-500/80 transition-colors">Server URL</label>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-[15px] text-white placeholder-stone-600 focus:outline-none focus:border-orange-500/50 focus:bg-black/40 transition-all duration-300"
                                placeholder="http://localhost:8080"
                                spellCheck={false}
                            />
                        </div>

                        {/* API Key Input */}
                        <div className="group relative">
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5 block group-focus-within:text-orange-500/80 transition-colors">API Key</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-[15px] text-white placeholder-stone-600 focus:outline-none focus:border-orange-500/50 focus:bg-black/40 transition-all duration-300 font-mono"
                                placeholder="sk-..."
                                spellCheck={false}
                            />
                        </div>
                    </div>
                </div>

                {/* Storage Card */}
                <div className="bg-stone-800/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Storage</label>

                    <div className="flex gap-3">
                        <div className="flex-1 group relative">
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5 block">Location</label>
                            <div className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-[14px] text-stone-300 font-mono truncate min-h-[48px] flex items-center">
                                {outputPath || 'Default'}
                            </div>
                        </div>
                        <div className="flex flex-col justify-end">
                            <button
                                onClick={handleBrowse}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 text-stone-400 hover:text-white w-[48px] h-[48px] rounded-lg transition-all active:scale-95 flex items-center justify-center shrink-0"
                                title="Select Folder"
                            >
                                <Folder size={20} />
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            {/* Footer Version */}
            <div className="mt-auto pb-4 pl-1 opacity-30 hover:opacity-100 transition-opacity">
                <p className="text-[10px] font-medium text-white/50 flex items-center gap-1.5">
                    <Sparkles size={10} />
                    <span>Scriberr Companion v0.1.0</span>
                </p>
            </div>
        </div>
    );
}
