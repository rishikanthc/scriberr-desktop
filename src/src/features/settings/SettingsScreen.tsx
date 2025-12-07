import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { open } from '@tauri-apps/plugin-dialog';
import { Save, Wifi, Loader2, Folder } from 'lucide-react';
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
        setMessage('Testing...');

        testConnectionMutation.mutate({ url, apiKey }, {
            onSuccess: (success) => {
                if (success) {
                    setStatus('success');
                    setMessage('Connected');
                } else {
                    setStatus('error');
                    setMessage('Failed');
                }
            },
            onError: () => {
                setStatus('error');
                setMessage('Error');
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
        setMessage('Saving...');

        saveMutation.mutate({ scriberr_url: url, api_key: apiKey, output_path: outputPath }, {
            onSuccess: () => {
                setStatus('success');
                setMessage('Saved');
                // Optional: Auto-go back or just stay? User said "save button should be enabled if changes made". 
                // Creating a ghost button implies we stay.
            },
            onError: (error) => {
                setStatus('error');
                setMessage(`Failed: ${error}`);
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full text-white/50">
                <Loader2 className="animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden px-2">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pt-2 shrink-0">
                <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>

                <button
                    onClick={handleSave}
                    disabled={!isDirty || status === 'saving'}
                    className={clsx(
                        "p-2 rounded-full transition-all duration-300",
                        isDirty
                            ? "text-amber-400 hover:bg-amber-400/10 hover:scale-105 active:scale-95"
                            : "text-white/20 cursor-not-allowed"
                    )}
                    title={isDirty ? "Save Changes" : "No changes to save"}
                >
                    {status === 'saving' ? (
                        <Loader2 size={24} className="animate-spin" />
                    ) : (
                        <Save size={24} />
                    )}
                </button>
            </div>

            <div className="flex-1 flex flex-col gap-8 overflow-y-auto min-h-0 pr-2 pb-6">

                {/* Connection Section */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">Connection</label>

                        {/* Status/Test Indicator */}
                        <div className="flex items-center gap-3">
                            {/* Status Text */}
                            <AnimatePresence mode="wait">
                                {status !== 'idle' && (
                                    <motion.span
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={clsx(
                                            "text-xs font-medium",
                                            status === 'success' && "text-green-400",
                                            status === 'error' && "text-red-400",
                                            (status === 'testing' || status === 'saving') && "text-blue-400"
                                        )}
                                    >
                                        {message}
                                    </motion.span>
                                )}
                            </AnimatePresence>

                            {/* Test Button */}
                            <button
                                onClick={handleTestConnection}
                                disabled={status === 'testing' || !url || !apiKey}
                                className="text-white/40 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Test Connection"
                            >
                                <Wifi size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="group bg-white/5 focus-within:bg-white/10 focus-within:ring-1 focus-within:ring-white/20 border border-white/5 rounded-xl transition-all overflow-hidden">
                            <label className="block px-4 pt-2.5 text-[10px] text-white/40 font-medium">SCRIBERR URL</label>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="w-full bg-transparent border-none px-4 pb-3 pt-0.5 text-sm text-white placeholder-white/20 focus:ring-0 focus:outline-none font-medium"
                                placeholder="http://localhost:8080"
                            />
                        </div>

                        <div className="group bg-white/5 focus-within:bg-white/10 focus-within:ring-1 focus-within:ring-white/20 border border-white/5 rounded-xl transition-all overflow-hidden">
                            <label className="block px-4 pt-2.5 text-[10px] text-white/40 font-medium">API KEY</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full bg-transparent border-none px-4 pb-3 pt-0.5 text-sm text-white placeholder-white/20 focus:ring-0 focus:outline-none font-mono"
                                placeholder="sk-..."
                            />
                        </div>
                    </div>
                </div>

                {/* Storage Section */}
                <div className="flex flex-col gap-4">
                    <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">Storage</label>

                    <div className="flex gap-2">
                        <div className="flex-1 group bg-white/5 border border-white/5 rounded-xl transition-all overflow-hidden flex items-center px-4 py-3">
                            <span className="text-sm text-white/80 font-mono truncate">{outputPath || 'Default'}</span>
                        </div>
                        <button
                            onClick={handleBrowse}
                            className="bg-white/5 hover:bg-white/10 border border-white/5 text-white/60 hover:text-white p-3 rounded-xl transition-colors shrink-0"
                            title="Select Folder"
                        >
                            <Folder size={20} />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
