import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TitleBar } from './components/TitleBar';
import { AppSelector } from './components/AppSelector';
import { Controls } from './components/Controls';
import { Timer } from './components/Timer';
import { MicSelector } from './components/MicSelector';
import logo from './assets/logo.svg';

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
    <div className="h-screen w-screen bg-stone-500/70 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col text-white select-none">
      <TitleBar />

      <div className="flex-1 flex flex-col p-6 gap-6">
        <div className="flex flex-col items-center justify-center gap-1">
          <img src={logo} alt="Scriberr" className="h-8 w-auto opacity-90" />
          <span className="text-[10px] font-bold tracking-[0.3em] text-white/40 font-sans">
            COMPANION
          </span>
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
              disabled={false}
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
