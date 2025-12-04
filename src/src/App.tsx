import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TitleBar } from './components/TitleBar';
import { AppSelector } from './components/AppSelector';
import { Controls } from './components/Controls';
import { Timer } from './components/Timer';
import { MicSelector } from './components/MicSelector';

function App() {
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const handleStart = async () => {
    if (!selectedPid) return;
    try {
      await invoke('start_recording_command', { pid: selectedPid });
      setIsRecording(true);
      setIsPaused(false);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handlePause = async () => {
    try {
      await invoke('pause_recording_command');
      setIsPaused(true);
    } catch (error) {
      console.error('Failed to pause:', error);
    }
  };

  const handleResume = async () => {
    try {
      await invoke('resume_recording_command');
      setIsPaused(false);
    } catch (error) {
      console.error('Failed to resume:', error);
    }
  };

  const handleStop = async () => {
    try {
      const folderPath = await invoke<string>('stop_recording_command');
      setIsRecording(false);
      setIsPaused(false);
      if (folderPath) {
        // Open the folder using the 'open' command (requires 'open' crate or similar, 
        // but we can use tauri's shell open if allowed, or just rely on user knowing location.
        // Actually, let's use the 'opener' plugin we added!)
        await invoke('plugin:opener|open_path', { path: folderPath });
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handleSelect = (pid: number) => {
    if (isRecording) return;
    if (selectedPid === pid) {
      setSelectedPid(null); // Deselect
    } else {
      setSelectedPid(pid);
    }
  };

  return (
    <div className="h-screen w-screen bg-stone-500/70 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden flex flex-col text-white select-none">
      <TitleBar />

      <div className="flex-1 flex flex-col p-6 gap-6">
        <div className="text-center">
          <h1 className="text-lg font-semibold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Scriberr Companion
          </h1>
          <p className="text-xs text-white/40 mt-1">Select an app to record audio</p>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-8">
          {isRecording ? (
            <Timer isActive={!isPaused} />
          ) : (
            <AppSelector
              selectedPid={selectedPid}
              onSelect={handleSelect}
              disabled={isRecording}
            />
          )}

          <div className="px-4">
            <MicSelector
              onSelect={(name) => invoke('switch_microphone_command', { deviceName: name })}
              disabled={false} // Always allow switching? Yes.
            />
          </div>

          <Controls
            isRecording={isRecording}
            isPaused={isPaused}
            onStart={handleStart}
            onStop={handleStop}
            onPause={handlePause}
            onResume={handleResume}
            disabled={!selectedPid}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
