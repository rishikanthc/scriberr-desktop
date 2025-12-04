import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { MicSelector } from './MicSelector';
import logo from '../assets/logo.svg';

interface SetupScreenProps {
    onStart: (filename: string, micDevice: string | null) => void;
    onBack: () => void;
    includeNone?: boolean;
}

export function SetupScreen({ onStart, onBack, includeNone = true }: SetupScreenProps) {
    const [filename, setFilename] = useState('');
    const [micDevice, setMicDevice] = useState<string | null>('Default');
    const [error, setError] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        setFilename(`recording_${timestamp}`);
    }, []);

    useEffect(() => {
        if (!filename.trim()) {
            setError(null);
            return;
        }

        const checkExistence = async () => {
            setIsChecking(true);
            try {
                const exists = await invoke<boolean>('check_file_exists_command', { filename });
                if (exists) {
                    setError('A file with this name already exists.');
                } else {
                    setError(null);
                }
            } catch (err) {
                console.error("Failed to check file existence", err);
            } finally {
                setIsChecking(false);
            }
        };

        const timeoutId = setTimeout(checkExistence, 300);
        return () => clearTimeout(timeoutId);
    }, [filename]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-6">
                <button onClick={onBack} className="text-white/60 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>
                <img src={logo} alt="Scriberr" className="h-5 w-auto opacity-90" />
            </div>

            <div className="flex-1 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Recording Name</label>
                    <input
                        type="text"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        className={`bg-black/20 border rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:bg-black/30 transition-all backdrop-blur-sm ${error ? 'border-red-500/50 focus:ring-red-500/50' : 'border-white/10 focus:ring-white/20'
                            }`}
                        placeholder="Enter filename..."
                        autoFocus
                    />
                    {error && (
                        <span className="text-xs text-red-400 ml-1">{error}</span>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Microphone</label>
                    <MicSelector
                        onSelect={(name) => setMicDevice(name)}
                        disabled={false}
                        includeNone={includeNone}
                    />
                </div>

                <div className="mt-auto">
                    <button
                        onClick={() => onStart(filename, micDevice)}
                        disabled={!!error || isChecking || !filename.trim()}
                        className={`w-full font-medium rounded-xl py-4 transition-all active:scale-[0.98] shadow-lg backdrop-blur-md ${!!error || isChecking || !filename.trim()
                                ? 'bg-white/5 text-white/40 cursor-not-allowed border border-white/5'
                                : 'bg-white/10 hover:bg-white/20 border border-white/10 text-white'
                            }`}
                    >
                        Start Recording
                    </button>
                </div>
            </div>
        </div>
    );
}
