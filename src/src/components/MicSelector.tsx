import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';

interface MicSelectorProps {
    onSelect: (deviceName: string | null) => void;
    disabled: boolean;
    includeNone?: boolean;
}

export function MicSelector({ onSelect, disabled, includeNone = false }: MicSelectorProps) {
    const [mics, setMics] = useState<{ id: string; name: string }[]>([]);
    const [selectedMic, setSelectedMic] = useState<string>('Default');
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        async function loadMics() {
            try {
                const list = await invoke<[string, string][]>('get_microphones_command');
                const formatted = list.map(([id, name]) => ({ id, name }));
                if (includeNone) {
                    formatted.unshift({ id: 'None', name: 'None (System Audio Only)' });
                }
                setMics(formatted);

                // Set initial selected mic
                if (formatted.length > 0) {
                    // If we have a stored selection that is valid, keep it.
                    // Otherwise default to first.
                    // For now, just default to first if 'Default' or invalid.
                    if (selectedMic === 'Default' || !formatted.some(m => m.id === selectedMic)) {
                        const defaultMic = formatted[0];
                        setSelectedMic(defaultMic.id);
                        onSelect(defaultMic.id === 'None' ? null : defaultMic.id);
                    }
                }
            } catch (e) {
                console.error('Failed to load mics', e);
            }
        }
        loadMics();
    }, [includeNone]); // Reload if includeNone changes

    const handleSelect = (id: string) => {
        setSelectedMic(id);
        onSelect(id === 'None' ? null : id);
        setIsOpen(false);
    };

    const selectedName = mics.find(m => m.id === selectedMic)?.name || 'Select Microphone';

    return (
        <div className="relative">
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-sm text-white transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/20'
                    }`}
            >
                <div className="flex items-center gap-2 truncate">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                    <span className="truncate">{selectedName}</span>
                </div>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`opacity-40 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                >
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 w-full mt-2 bg-neutral-900 border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                    >
                        {mics.map((mic) => (
                            <button
                                key={mic.id}
                                onClick={() => handleSelect(mic.id)}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors ${selectedMic === mic.id
                                        ? 'bg-white/20 text-white'
                                        : 'text-white/60 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                {mic.name}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
