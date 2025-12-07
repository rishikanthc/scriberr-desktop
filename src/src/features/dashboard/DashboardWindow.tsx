import { useState } from 'react';
import { Settings, Mic, Folder } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { RecordingList } from '../library/RecordingList';
import { SettingsScreen } from '../settings/SettingsScreen';
import { TitleBar } from '../../components/TitleBar';
import clsx from 'clsx';

type View = 'recordings' | 'settings';

export function DashboardWindow() {
    const [currentView, setCurrentView] = useState<View>('recordings');

    const toggleRecorder = async () => {
        const recorder = await WebviewWindow.getByLabel('recorder');
        if (recorder) {
            const isVisible = await recorder.isVisible();
            if (isVisible) {
                await recorder.hide();
            } else {
                await recorder.show();
                await recorder.setFocus();
            }
        }
    };

    return (
        <div className="h-screen w-screen bg-stone-800/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col text-stone-200 select-none relative font-sans antialiased selection:bg-orange-500/30">
            <TitleBar />

            {/* Content Area */}
            <div className="flex-1 relative overflow-hidden">
                <AnimatePresence mode="wait">
                    {currentView === 'recordings' ? (
                        <motion.div
                            key="recordings"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className="h-full w-full p-6"
                        >
                            <RecordingList />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="settings"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="h-full w-full p-6"
                        >
                            <SettingsScreen onBack={() => setCurrentView('recordings')} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Navigation Bar */}
            <div className="shrink-0 flex items-center justify-center pb-5 pt-3 z-20">
                <div className="flex items-center gap-1 bg-stone-800/90 backdrop-blur-xl border border-white/10 rounded-full px-2 py-1.5 shadow-2xl">
                    <NavButton
                        icon={<Folder size={20} />}
                        isActive={currentView === 'recordings'}
                        onClick={() => setCurrentView('recordings')}
                        label="Library"
                    />

                    <div className="w-px h-3 bg-white/10 mx-1" />

                    <NavButton
                        icon={<Mic size={20} />}
                        isActive={false}
                        onClick={toggleRecorder}
                        label="Recorder"
                        className="text-white/60 hover:text-red-400 hover:bg-transparent"
                    />

                    <div className="w-px h-3 bg-white/10 mx-1" />

                    <NavButton
                        icon={<Settings size={20} />}
                        isActive={currentView === 'settings'}
                        onClick={() => setCurrentView('settings')}
                        label="Settings"
                    />
                </div>
            </div>
        </div>
    );
}

interface NavButtonProps {
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
    label: string;
    className?: string;
}

function NavButton({ icon, isActive, onClick, label, className }: NavButtonProps) {
    return (
        <button
            onClick={onClick}
            title={label}
            className={clsx(
                "p-2 rounded-lg transition-all duration-300 relative group",
                isActive ? "text-amber-400 bg-white/5" : "text-white/40 hover:text-white hover:bg-white/5",
                className
            )}
        >
            {icon}
        </button>
    );
}
