import { X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface TitleBarProps {
    isConnected: boolean;
    onClose?: () => void;
}

export function TitleBar({ isConnected, onClose }: TitleBarProps) {
    const closeWindow = async () => {
        if (onClose) {
            onClose();
        } else {
            await getCurrentWindow().hide();
        }
    };

    return (
        <div data-tauri-drag-region className="h-10 flex items-center justify-between px-4 cursor-grab active:cursor-grabbing w-full shrink-0">
            {/* Connectivity Indicator */}
            <div className="flex items-center gap-1.5" title={isConnected ? "Connected to Scriberr" : "Not Connected"}>
                <div className={`w-2 h-2 rounded-full transition-colors ${isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500/50"}`} />
            </div>

            <button
                onClick={closeWindow}
                className="text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
            >
                <X size={16} />
            </button>
        </div>
    );
}
