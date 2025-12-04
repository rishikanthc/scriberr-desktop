import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

interface ReviewScreenProps {
    initialFilename: string;
    filePath: string;
    onSave: () => Promise<void>;
    onDiscard: () => void;
    onExit: () => void;
}

export function ReviewScreen({ initialFilename, filePath, onSave, onDiscard, onExit }: ReviewScreenProps) {
    const [filename, setFilename] = useState(initialFilename);
    const [status, setStatus] = useState<'idle' | 'saving' | 'success'>('idle');

    const handleSave = async () => {
        setStatus('saving');
        // Simulate a small delay for better UX if operation is too fast
        const minTime = new Promise(resolve => setTimeout(resolve, 800));

        try {
            await Promise.all([onSave(), minTime]);
            setStatus('success');

            // Wait for success animation then exit
            setTimeout(() => {
                onExit();
            }, 1500);
        } catch (error) {
            console.error("Save failed:", error);
            // If it fails (e.g. opening folder failed), we should probably still let the user exit or try again.
            // For now, let's just go to success/exit so they aren't stuck, 
            // or maybe revert to idle?
            // Reverting to idle lets them try again.
            setStatus('idle');
            // Maybe show an alert?
            // alert("Failed to open folder, but recording is saved.");
        }
    };

    return (
        <div className="flex flex-col h-full gap-6 relative">
            <AnimatePresence>
                {status === 'success' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-neutral-900/80 backdrop-blur-md rounded-xl"
                    >
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 mb-4"
                        >
                            <Check size={32} className="text-white" strokeWidth={3} />
                        </motion.div>
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-white font-medium text-lg"
                        >
                            Saved Successfully
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="text-center">
                <h2 className="text-xl font-semibold text-white">Recording Finished</h2>
                <p className="text-white/40 text-sm mt-1">Review your recording</p>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Filename</label>
                <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    disabled={status !== 'idle'}
                    className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 focus:bg-black/30 transition-all backdrop-blur-sm disabled:opacity-50"
                />
            </div>

            <div className="mt-auto flex gap-3">
                <button
                    onClick={onDiscard}
                    disabled={status !== 'idle'}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-medium rounded-xl py-3 transition-all active:scale-[0.98] backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Discard
                </button>
                <button
                    onClick={handleSave}
                    disabled={status !== 'idle'}
                    className="flex-1 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-medium rounded-xl py-3 transition-all active:scale-[0.98] shadow-lg backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {status === 'saving' ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            <span>Saving...</span>
                        </>
                    ) : (
                        <span>Save</span>
                    )}
                </button>
            </div>
        </div>
    );
}
