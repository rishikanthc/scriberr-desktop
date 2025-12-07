import { useState } from 'react';
import { Settings, Mic, Folder, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RecordingList } from '../library/RecordingList';
import { SettingsScreen } from '../settings/SettingsScreen';
import { RecorderScreen } from '../recorder/RecorderScreen';
import { TitleBar } from '../../components/TitleBar';
import clsx from 'clsx';

type View = 'recordings' | 'settings' | 'recorder';

export function DashboardWindow() {
    const [currentView, setCurrentView] = useState<View>('recordings');

    return (
        <div className="h-screen w-screen bg-glass-base backdrop-blur-xl rounded-2xl border border-glass-border shadow-2xl overflow-hidden flex flex-col text-stone-200 select-none relative font-sans antialiased selection:bg-accent-primary/30">
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
                    ) : currentView === 'settings' ? (
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
                    ) : (
                        <motion.div
                            key="recorder"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="h-full w-full"
                        >
                            <RecorderScreen />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Version Footer */}
            <div className="absolute bottom-4 left-5 opacity-30 hover:opacity-100 transition-opacity z-30 pointer-events-auto">
                <p className="text-[10px] font-medium text-stone-500 flex items-center gap-1.5 cursor-default">
                    <Sparkles size={10} />
                    <span>v0.1.0</span>
                </p>
            </div>

            {/* Bottom Navigation Bar */}
            <div className="shrink-0 flex items-center justify-center pb-5 pt-3 z-20">
                <div className="flex items-center gap-1 bg-glass-base backdrop-blur-xl border border-glass-border rounded-full px-2 py-1.5 shadow-2xl">
                    <NavButton
                        icon={<Folder size={20} />}
                        isActive={currentView === 'recordings'}
                        onClick={() => setCurrentView('recordings')}
                        label="Library"
                    />

                    <div className="w-px h-3 bg-glass-border mx-1" />

                    <NavButton
                        icon={<Mic size={20} />}
                        isActive={currentView === 'recorder'}
                        onClick={() => setCurrentView('recorder')}
                        label="Recorder"
                        className={clsx(
                            currentView === 'recorder' ? "text-accent-primary" : "text-white/60 hover:text-white"
                        )}
                    />

                    <div className="w-px h-3 bg-glass-border mx-1" />

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
                "p-2 rounded-lg transition-all duration-300 relative group cursor-pointer",
                isActive ? "text-accent-primary bg-glass-highlight" : "text-white/40 hover:text-white hover:bg-glass-highlight",
                className
            )}
        >
            {icon}
        </button>
    );
}
