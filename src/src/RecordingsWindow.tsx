import { RecordingList } from './features/library/RecordingList';
import { TitleBar } from './components/TitleBar';
import { ConnectivityIndicator } from './components/ConnectivityIndicator';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function RecordingsWindow() {
    const handleClose = () => {
        getCurrentWindow().hide();
    };

    return (
        <div className="h-screen w-screen bg-neutral-700/85 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col text-white select-none relative">
            <TitleBar onClose={handleClose} />

            <div className="flex-1 flex flex-col px-6 pb-6 pt-2 overflow-hidden">
                <div className="flex-1 overflow-hidden">
                    <RecordingList />
                </div>
            </div>

            <div className="absolute bottom-4 right-4 pointer-events-none">
                <ConnectivityIndicator isConnected={true} />
            </div>
        </div>
    );
}
