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
        <div className="relative w-full">
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white transition-all backdrop-blur-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black/30'
                    }`}
            >
                <div className="flex items-center gap-2 truncate">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                    <span className="truncate">{isLoading ? 'Loading...' : selectedLabel}</span>
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
                        className="absolute z-50 w-full mt-2 bg-neutral-900/90 border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto backdrop-blur-md"
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
