import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MicSelectorProps {
    devices: { deviceId: string; label: string }[];
    selectedDevice: string;
    onSelect: (deviceId: string) => void;
    disabled?: boolean;
    isLoading?: boolean;
}

export function MicSelector({ devices, selectedDevice, onSelect, disabled = false, isLoading = false }: MicSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (id: string) => {
        onSelect(id);
        setIsOpen(false);
    };

    const selectedLabel = devices.find(d => d.deviceId === selectedDevice)?.label || 'Select Microphone';

    return (
        <div className="relative w-full z-50">
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between bg-glass-input/50 border border-glass-border hover:bg-glass-input/80 hover:border-glass-highlight rounded-xl px-4 py-3 text-sm text-stone-200 transition-all backdrop-blur-xl shadow-lg ${disabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
            >
                <div className="flex items-center gap-3 truncate">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-primary">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                    <span className="truncate font-medium">{isLoading ? 'Loading...' : selectedLabel}</span>
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
                    className={`opacity-40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                >
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute bottom-full mb-2 w-full bg-glass-surface/95 border border-glass-border rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto backdrop-blur-2xl ring-1 ring-black/20"
                    >
                        {devices.map((mic) => (
                            <button
                                key={mic.deviceId}
                                onClick={() => handleSelect(mic.deviceId)}
                                className={`w-full text-left px-4 py-3 text-sm transition-colors ${selectedDevice === mic.deviceId
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                {mic.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
