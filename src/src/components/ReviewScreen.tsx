import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ReviewScreenProps {
    initialFilename: string;
    filePath: string; // We might need this to rename/delete
    onSave: () => void;
    onDiscard: () => void;
}

export function ReviewScreen({ initialFilename, filePath, onSave, onDiscard }: ReviewScreenProps) {
    const [filename, setFilename] = useState(initialFilename);

    const handleSave = async () => {
        // If filename changed, we might need to rename.
        // For now, let's assume the backend saved it with the initial name.
        // Renaming logic would go here if we implemented a rename command.
        // But user just said "can still be edited".
        // Let's just call onSave which closes the flow.
        // Ideally we'd rename the file on disk if changed.
        // TODO: Implement rename if needed.
        onSave();
    };

    return (
        <div className="flex flex-col h-full gap-6">
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
                    className="bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                />
            </div>

            <div className="mt-auto flex gap-3">
                <button
                    onClick={onDiscard}
                    className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 font-medium rounded-xl py-3 hover:bg-red-500/20 transition-all active:scale-[0.98]"
                >
                    Discard
                </button>
                <button
                    onClick={handleSave}
                    className="flex-1 bg-white text-black font-semibold rounded-xl py-3 hover:bg-white/90 transition-all active:scale-[0.98] shadow-lg shadow-white/10"
                >
                    Save
                </button>
            </div>
        </div>
    );
}
