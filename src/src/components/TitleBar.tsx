import { X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import logoIcon from '../assets/scriberr-icon-cropped.png';
import { ScriberrTextLogo } from './ScriberrTextLogo';

interface TitleBarProps {
    onClose?: () => void;
    variant?: 'home' | 'default';
}

export function TitleBar({ onClose, variant = 'default' }: TitleBarProps) {
    const closeWindow = async () => {
        if (onClose) {
            onClose();
        } else {
            await getCurrentWindow().hide();
        }
    };

    return (
        <div data-tauri-drag-region className="h-16 flex items-center justify-between px-5 cursor-grab active:cursor-grabbing w-full shrink-0">
            {/* Logo Section */}
            <div className="flex items-center gap-2 pointer-events-none">
                <img src={logoIcon} alt="Scriberr" className="h-8 w-8 drop-shadow-lg p-0 m-0" />
                <div className="flex flex-col justify-center h-full p-0">
                    <ScriberrTextLogo color="#ffffff" className="h-4 w-auto mb-0.5" />
                    <span className="text-[8px] font-bold tracking-[0.3em] text-white/50 font-sans leading-none flex justify-center items-center">
                        COMPANION
                    </span>
                </div>
            </div>

            <button
                onClick={closeWindow}
                className="text-white/50 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
            >
                <X size={18} />
            </button>
        </div>
    );
}
