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
        <div className="h-screen w-screen bg-stone-700/85 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col text-white select-none relative">
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
            <div className="h-20 shrink-0 flex items-center justify-center gap-12 bg-black/20 border-t border-white/5 backdrop-blur-md z-20">
                <NavButton
                    icon={<Folder size={20} />}
                    isActive={currentView === 'recordings'}
                    onClick={() => setCurrentView('recordings')}
                    label="Library"
                />

                <NavButton
                    icon={<Mic size={20} />}
                    isActive={false}
                    onClick={toggleRecorder}
                    label="Recorder"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                />

                <NavButton
                    icon={<Settings size={20} />}
                    isActive={currentView === 'settings'}
                    onClick={() => setCurrentView('settings')}
                    label="Settings"
                />
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
                "flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200 group relative min-w-[64px]",
                isActive ? "text-white" : "text-white/40 hover:text-white hover:bg-white/5",
                className
            )}
        >
            <div className={clsx(
                "p-2 rounded-lg transition-all",
                isActive ? "bg-white/10 shadow-sm" : ""
            )}>
                {icon}
            </div>
            <span className="text-[10px] font-medium tracking-wide opacity-80 uppercase">{label}</span>
        </button>
    );
}
