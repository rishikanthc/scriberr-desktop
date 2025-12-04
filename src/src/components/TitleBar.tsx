import { X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function TitleBar() {
    const closeWindow = async () => {
        await getCurrentWindow().hide();
    };

    return (
        <div data-tauri-drag-region className="h-10 flex items-center justify-end px-4 cursor-grab active:cursor-grabbing w-full">
            <button
                onClick={closeWindow}
                className="text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
            >
                <X size={16} />
            </button>
        </div>
    );
}
