import { RecordingList } from './components/RecordingList';
import { TitleBar } from './components/TitleBar';
import logo from './assets/logo.svg';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function RecordingsWindow() {
    const handleClose = () => {
        getCurrentWindow().hide();
    };

    return (
        <div className="h-screen w-screen bg-neutral-700/70 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col text-white select-none">
            <TitleBar isConnected={true} onClose={handleClose} />

            <div className="flex-1 flex flex-col px-6 pb-6 pt-2 overflow-hidden">
                <div className="flex items-center justify-center gap-1 mb-4">
                    <img src={logo} alt="Scriberr" className="h-6 w-auto opacity-100" />
                    <span className="text-[8px] font-bold tracking-[0.3em] text-white/40 font-sans">
                        RECORDINGS
                    </span>
                </div>

                <div className="flex-1 overflow-hidden">
                    <RecordingList />
                </div>
            </div>
        </div>
    );
}
