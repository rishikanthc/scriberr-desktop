import { Timer } from './Timer';
import { Controls } from './Controls';

interface RecordingScreenProps {
    isPaused: boolean;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
}

export function RecordingScreen({ isPaused, onPause, onResume, onStop }: RecordingScreenProps) {
    return (
        <div className="flex flex-col h-full justify-center items-center gap-8">
            <div className="scale-150">
                <Timer isActive={!isPaused} />
            </div>

            <div className="w-full">
                <Controls
                    isRecording={true}
                    isPaused={isPaused}
                    onStart={() => { }} // Not used here
                    onStop={onStop}
                    onPause={onPause}
                    onResume={onResume}
                    disabled={false}
                />
            </div>
        </div>
    );
}
