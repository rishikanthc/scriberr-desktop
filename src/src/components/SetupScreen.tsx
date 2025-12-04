import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { MicSelector } from './MicSelector';
import logo from '../assets/logo.svg';

interface SetupScreenProps {
    onStart: (filename: string, micDevice: string | null) => void;
    onBack: () => void;
}

export function SetupScreen({ onStart, onBack }: SetupScreenProps) {
    const [filename, setFilename] = useState('');
    const [micDevice, setMicDevice] = useState<string | null>('Default');

    useEffect(() => {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        setFilename(`recording_${timestamp}`);
    }, []);

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
                        className="bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                        placeholder="Enter filename..."
                        autoFocus
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Microphone</label>
                    <MicSelector
                        onSelect={(name) => setMicDevice(name)}
                        disabled={false}
                        includeNone={true}
                    />
                </div>

                <div className="mt-auto">
                    <button
                        onClick={() => onStart(filename, micDevice)}
                        className="w-full bg-white text-black font-semibold rounded-xl py-4 hover:bg-white/90 transition-all active:scale-[0.98] shadow-lg shadow-white/10"
                    >
                        Start Recording
                    </button>
                </div>
            </div>
        </div>
    );
}
