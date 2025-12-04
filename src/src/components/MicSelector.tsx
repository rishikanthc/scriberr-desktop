import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Mic } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface MicSelectorProps {
    onSelect: (deviceName: string) => void;
    disabled?: boolean;
}

export function MicSelector({ onSelect, disabled }: MicSelectorProps) {
    const [mics, setMics] = useState<[string, string][]>([]);
    const [selectedMic, setSelectedMic] = useState<string>('');
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        loadMics();
    }, []);

    const loadMics = async () => {
        try {
            const devices = await invoke<[string, string][]>('get_microphones_command');
            setMics(devices);
            if (devices.length > 0 && !selectedMic) {
                // Default to first one or try to find "Default"
                // For now just pick first
                setSelectedMic(devices[0][0]);
                onSelect(devices[0][0]);
            }
        } catch (error) {
            console.error('Failed to load microphones:', error);
        }
    };

    const handleSelect = (name: string) => {
        setSelectedMic(name);
        onSelect(name);
        setIsOpen(false);
    };

    return (
        <div className="relative z-50">
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={clsx(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full",
                    "bg-white/5 hover:bg-white/10 border border-white/10 text-white/80",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
            >
                <Mic size={14} />
                <span className="truncate flex-1 text-left">
                    {selectedMic || "Select Microphone"}
                </span>
                <span className="text-[10px] opacity-50">▼</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                    >
                        {mics.map(([name, label]) => (
                            <button
                                key={name}
                                onClick={() => handleSelect(name)}
                                className={clsx(
                                    "w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors truncate",
                                    selectedMic === name ? "text-white bg-white/5" : "text-white/60"
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
