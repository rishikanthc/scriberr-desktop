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
        <div className="flex flex-col h-full overflow-hidden px-1">
            {/* Header: H1, SemiBold, -2% tracking */}
            <div className="flex items-center justify-between mb-8 pt-3 shrink-0 px-1">
                <h1 className="text-[28px] font-semibold text-white/95 tracking-tight leading-none">Settings</h1>

                <button
                    onClick={handleSave}
                    disabled={!isDirty || status === 'saving'}
                    className={clsx(
                        "p-2.5 rounded-full transition-all duration-300 relative group",
                        isDirty
                            ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95"
                            : "text-white/20 cursor-not-allowed"
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

            <div className="flex-1 flex flex-col gap-8 overflow-y-auto min-h-0 pr-1 pb-6 scrollbar-hide">

                {/* Connection Section */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between px-1">
                        {/* H3/Section Label: 12px, SemiBold/Bold, +5% tracking */}
                        <label className="text-[11px] font-bold text-white/50 uppercase tracking-[0.05em]">Connection</label>

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
                                            "text-[11px] font-semibold tracking-wide",
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
                                className="text-white/40 hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed p-1"
                                title="Test Network Connection"
                            >
                                <Server size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {/* URL Input */}
                        <div className="group bg-white/5 focus-within:bg-white/10 focus-within:ring-1 focus-within:ring-white/10 border border-white/5 rounded-xl transition-all overflow-hidden flex flex-col justify-center min-h-[56px] px-4">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.05em] mb-0.5 group-focus-within:text-white/60 transition-colors">Server URL</label>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="w-full bg-transparent border-none p-0 text-[15px] text-white/90 placeholder-white/20 focus:ring-0 focus:outline-none font-medium leading-relaxed"
                                placeholder="http://localhost:8080"
                                spellCheck={false}
                            />
                        </div>

                        {/* API Key Input */}
                        <div className="group bg-white/5 focus-within:bg-white/10 focus-within:ring-1 focus-within:ring-white/10 border border-white/5 rounded-xl transition-all overflow-hidden flex flex-col justify-center min-h-[56px] px-4">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.05em] mb-0.5 group-focus-within:text-white/60 transition-colors">API Key</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full bg-transparent border-none p-0 text-[15px] text-white/90 placeholder-white/20 focus:ring-0 focus:outline-none font-medium font-mono leading-relaxed" // Monospace for API key
                                placeholder="sk-..."
                                spellCheck={false}
                            />
                        </div>
                    </div>
                </div>

                {/* Storage Section */}
                <div className="flex flex-col gap-4">
                    <label className="px-1 text-[11px] font-bold text-white/50 uppercase tracking-[0.05em]">Storage</label>

                    <div className="flex gap-2">
                        <div className="flex-1 group bg-white/5 border border-white/5 rounded-xl transition-all overflow-hidden flex flex-col justify-center min-h-[56px] px-4">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.05em] mb-0.5">Location</label>
                            <span className="text-[14px] text-white/80 font-mono truncate leading-relaxed">{outputPath || 'Default'}</span>
                        </div>
                        <button
                            onClick={handleBrowse}
                            className="bg-white/5 hover:bg-white/10 border border-white/5 text-white/60 hover:text-white w-[56px] h-[56px] rounded-xl transition-all active:scale-95 flex items-center justify-center shrink-0"
                            title="Select Folder"
                        >
                            <Folder size={22} className="opacity-80" />
                        </button>
                    </div>
                </div>

                {/* Info / Version (Deference) */}
                <div className="mt-auto px-1 opacity-30 hover:opacity-100 transition-opacity">
                    <p className="text-[10px] font-medium text-white/70 flex items-center gap-1.5">
                        <Sparkles size={10} />
                        <span>Scriberr Companion v0.1.0</span>
                    </p>
                </div>

            </div>
        </div>
    );
}
