import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { Server, Folder, ArrowRight, Check, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useSaveSettings, useTestConnection } from '../settings/api/useSettings';

interface OnboardingScreenProps {
    onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
    const saveMutation = useSaveSettings();
    const testConnectionMutation = useTestConnection();

    const [url, setUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [outputPath, setOutputPath] = useState('');

    // Steps: 0 = Intro, 1 = Config
    const [step, setStep] = useState(0);

    const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error' | 'saving'>('idle');
    const [message, setMessage] = useState('');

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
            }
        } catch (err) {
            console.error("Failed to pick folder:", err);
        }
    };

    const handleTestAndSave = async () => {
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
        setMessage('Verifying connection...');

        // 1. Test Connection
        testConnectionMutation.mutate({ url, apiKey }, {
            onSuccess: (success) => {
                if (success) {
                    setStatus('saving');
                    setMessage('Saving configuration...');

                    // 2. Save Settings
                    saveMutation.mutate({
                        scriberr_url: url,
                        api_key: apiKey,
                        output_path: outputPath || '' // Optional, will default in backend if empty
                    }, {
                        onSuccess: () => {
                            setStatus('success');
                            setMessage('Reaady to go!');
                            setTimeout(() => {
                                onComplete();
                            }, 500);
                        },
                        onError: (error) => {
                            setStatus('error');
                            setMessage(`Save failed: ${error}`);
                        }
                    });

                } else {
                    setStatus('error');
                    setMessage('Connection failed. Check URL/Key.');
                }
            },
            onError: () => {
                setStatus('error');
                setMessage('Network error during test.');
            }
        });
    };

    return (
        <div className="h-screen w-screen bg-stone-950 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-sky-900/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />

            <AnimatePresence mode="wait">
                {step === 0 && (
                    <motion.div
                        key="intro"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="max-w-md w-full flex flex-col items-center text-center gap-8"
                    >
                        <div className="relative">
                            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-4 mx-auto">
                                <span className="text-4xl font-bold text-white">S</span>
                            </div>
                            <div className="absolute inset-0 bg-white/20 blur-xl rounded-3xl -z-10" />
                        </div>

                        <div className="space-y-4">
                            <h1 className="text-3xl font-bold text-white tracking-tight">Welcome to Scriberr</h1>
                            <p className="text-white/60 text-lg leading-relaxed">
                                Your AI-powered companion for seamless audio transcription and synchronization.
                            </p>
                        </div>

                        <button
                            onClick={() => setStep(1)}
                            className="group flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-semibold hover:bg-white/90 hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                        >
                            <span>Get Started</span>
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </motion.div>
                )}

                {step === 1 && (
                    <motion.div
                        key="config"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="max-w-[400px] w-full"
                    >
                        <div className="bg-glass-surface backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl flex flex-col gap-6 relative overflow-hidden">
                            {/* Header */}
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2">Setup Connection</h2>
                                <p className="text-white/40 text-sm">Connect to your Scriberr server to begin.</p>
                            </div>

                            {/* Inputs */}
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">Server URL</label>
                                    <div className="relative group">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-accent-primary transition-colors">
                                            <Server size={16} />
                                        </div>
                                        <input
                                            type="text"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="https://scriberr.example.com"
                                            className="w-full bg-black/20 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent-primary/50 transition-colors placeholder:text-white/20"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">API Key</label>
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="sk-..."
                                        className="w-full bg-black/20 border border-white/5 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-accent-primary/50 transition-colors placeholder:text-white/20 font-mono"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest pl-1">Recordings Folder (Optional)</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-black/20 border border-white/5 rounded-xl py-3 px-4 text-xs text-white/60 truncate flex items-center h-[42px]">
                                            {outputPath || 'Default (Documents/ScriberrRecordings)'}
                                        </div>
                                        <button
                                            onClick={handleBrowse}
                                            className="w-[42px] h-[42px] flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-white/60 hover:text-white transition-colors"
                                        >
                                            <Folder size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Status Message */}
                            <div className={clsx("h-6 flex items-center gap-2 text-xs font-medium justify-center transition-colors",
                                status === 'error' ? "text-red-400" :
                                    status === 'success' ? "text-emerald-400" :
                                        "text-white/40"
                            )}>
                                {status === 'testing' || status === 'saving' ? <Loader2 size={12} className="animate-spin" /> : null}
                                {message}
                            </div>

                            {/* Action Button */}
                            <button
                                onClick={handleTestAndSave}
                                disabled={status === 'testing' || status === 'saving'}
                                className={clsx(
                                    "w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300",
                                    status === 'success'
                                        ? "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                        : "bg-accent-primary hover:bg-accent-hover text-white shadow-[0_0_20px_rgba(255,140,0,0.3)] disabled:opacity-50 disabled:shadow-none"
                                )}
                            >
                                {status === 'success' ? (
                                    <>
                                        <Check size={18} strokeWidth={3} />
                                        <span>Connected!</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Connect & Continue</span>
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
