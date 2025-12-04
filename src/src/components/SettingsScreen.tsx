import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { ArrowLeft, Save, Wifi, WifiOff, Loader2, CheckCircle, AlertCircle, Folder } from 'lucide-react';
import clsx from 'clsx';
import logo from '../assets/logo.svg';

interface SettingsScreenProps {
    onBack: () => void;
}

interface Settings {
    scriberr_url: string;
    api_key: string;
    output_path: string;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
    const [url, setUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [outputPath, setOutputPath] = useState('');
    const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error' | 'saving'>('idle');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const settings = await invoke<Settings>('load_settings_command');
            setUrl(settings.scriberr_url);
            setApiKey(settings.api_key);
            setOutputPath(settings.output_path);
        } catch (e) {
            console.error('Failed to load settings:', e);
        } finally {
            setLoading(false);
        }
    };

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
            setMessage('Please fill in all fields');
            return;
        }

        if (!validateUrl(url)) {
            setStatus('error');
            setMessage('Invalid URL format (e.g., http://localhost:8080)');
            return;
        }

        setStatus('testing');
        setMessage('Testing connection...');

        try {
            const success = await invoke<boolean>('check_connection_command', { url, apiKey });
            if (success) {
                setStatus('success');
                setMessage('Connected successfully!');
            } else {
                setStatus('error');
                setMessage('Connection failed. Check URL and API Key.');
            }
        } catch (e) {
            setStatus('error');
            setMessage(`Connection error: ${e}`);
        }
    };

    const handleSave = async () => {
        if (!url || !apiKey || !outputPath) {
            setStatus('error');
            setMessage('Please fill in all fields');
            return;
        }

        if (!validateUrl(url)) {
            setStatus('error');
            setMessage('Invalid URL format');
            return;
        }

        setStatus('saving');
        setMessage('Saving settings (moving files if needed)...');

        try {
            await invoke('save_settings_command', {
                settings: { scriberr_url: url, api_key: apiKey, output_path: outputPath }
            });

            setStatus('success');
            setMessage('Settings saved!');
            setTimeout(() => {
                onBack();
            }, 1000);
        } catch (e) {
            setStatus('error');
            setMessage(`Failed to save: ${e}`);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-white/50">
                <Loader2 className="animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4 shrink-0">
                <button
                    onClick={onBack}
                    className="text-white/60 hover:text-white transition-colors p-1 -ml-1 rounded-lg hover:bg-white/10"
                >
                    <ArrowLeft size={18} />
                </button>
                <span className="text-base font-medium text-white/90">Settings</span>
                <div className="ml-auto opacity-50">
                    <img src={logo} alt="Scriberr" className="h-4 w-auto" />
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-0 pr-1 flex flex-col gap-4">
                {/* URL Input */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-medium text-white/60 uppercase tracking-wider">Scriberr URL</label>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => {
                            setUrl(e.target.value);
                            setStatus('idle');
                            setMessage('');
                        }}
                        className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 focus:bg-black/30 transition-all backdrop-blur-sm"
                        placeholder="http://localhost:8080"
                    />
                </div>

                {/* API Key Input */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-medium text-white/60 uppercase tracking-wider">API Key</label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => {
                            setApiKey(e.target.value);
                            setStatus('idle');
                            setMessage('');
                        }}
                        className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 focus:bg-black/30 transition-all backdrop-blur-sm font-mono"
                        placeholder="sk-..."
                    />
                </div>

                {/* Storage Location Input */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-medium text-white/60 uppercase tracking-wider">Storage Location</label>
                    <div className="flex gap-2">
                        <div className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 truncate font-mono flex items-center">
                            <span className="truncate">{outputPath || 'Default'}</span>
                        </div>
                        <button
                            onClick={handleBrowse}
                            className="bg-white/10 hover:bg-white/20 border border-white/10 text-white p-2 rounded-lg transition-colors"
                            title="Select Folder"
                        >
                            <Folder size={18} />
                        </button>
                    </div>
                </div>

                {/* Status Message */}
                {status !== 'idle' && (
                    <div className={clsx(
                        "flex items-center gap-2 text-xs p-2.5 rounded-lg backdrop-blur-md border",
                        (status === 'testing' || status === 'saving') && "bg-blue-500/10 border-blue-500/20 text-blue-200",
                        status === 'success' && "bg-green-500/10 border-green-500/20 text-green-200",
                        status === 'error' && "bg-red-500/10 border-red-500/20 text-red-200"
                    )}>
                        {(status === 'testing' || status === 'saving') && <Loader2 size={14} className="animate-spin" />}
                        {status === 'success' && <CheckCircle size={14} />}
                        {status === 'error' && <AlertCircle size={14} />}
                        <span>{message}</span>
                    </div>
                )}
            </div>

            <div className="mt-4 flex flex-col gap-2 shrink-0">
                <button
                    onClick={handleTestConnection}
                    disabled={status === 'testing' || status === 'saving' || !url || !apiKey}
                    className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-sm font-medium rounded-lg py-2.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Wifi size={16} />
                    Test Connection
                </button>

                <button
                    onClick={handleSave}
                    disabled={status === 'testing' || status === 'saving' || !url || !apiKey}
                    className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white text-sm font-medium rounded-lg py-2.5 transition-all active:scale-[0.98] shadow-lg backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={16} />
                    Save Settings
                </button>
            </div>
        </div>
    );
}
