import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TitleBar } from './components/TitleBar';
import { AppSelector } from './components/AppSelector';
import { SetupScreen } from './components/SetupScreen';
import { RecordingScreen } from './components/RecordingScreen';
import { ReviewScreen } from './components/ReviewScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { RecordingList } from './components/RecordingList';
import logo from './assets/logo.svg';
import { Settings, FolderOpen, Folder } from 'lucide-react';
import clsx from 'clsx';

import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

type AppStep = 'home' | 'setup' | 'recording' | 'review' | 'settings';

function App() {
  const [step, setStep] = useState<AppStep>('home');
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [filename, setFilename] = useState('');
  const [micDevice, setMicDevice] = useState<string | null>(null);
  const [recordedFilePath, setRecordedFilePath] = useState('');
  const [recordedFolderPath, setRecordedFolderPath] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    checkConnectivity();

    // Periodic check every 30 seconds
    const interval = setInterval(checkConnectivity, 30000);
    return () => clearInterval(interval);
  }, [step]); // Re-check when returning to home or changing steps

  const checkConnectivity = async () => {
    try {
      const settings = await invoke<{ scriberr_url: string; api_key: string }>('load_settings_command');
      if (settings.scriberr_url && settings.api_key) {
        const connected = await invoke<boolean>('check_connection_command', {
          url: settings.scriberr_url,
          apiKey: settings.api_key
        });
        setIsConnected(connected);
      } else {
        setIsConnected(false);
      }
    } catch (e) {
      setIsConnected(false);
    }
  };

  const handleAppSelect = (pid: number) => {
    if (selectedPid === pid) {
      setSelectedPid(null);
    } else {
      setSelectedPid(pid);
    }
  };

  const handleNewRecordingClick = () => {
    if (selectedPid) {
      setStep('setup');
    }
  };

  const handleStartRecording = async (name: string, mic: string | null) => {
    if (selectedPid === null) return;
    try {
      setFilename(name);
      setMicDevice(mic);
      await invoke('start_recording_command', {
        pid: selectedPid,
        filename: name,
        micDevice: mic
      });
      setStep('recording');
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
      interface RecordingResult {
        file_path: string;
        folder_path: string;
      }
      const result = await invoke<RecordingResult>('stop_recording_command');

      setRecordedFilePath(result.file_path);
      setRecordedFolderPath(result.folder_path);

      setStep('review');
      setIsPaused(false);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handleSave = async () => {
    // Add to ledger
    if (recordedFilePath) {
      try {
        await invoke('add_recording_command', { filePath: recordedFilePath });
      } catch (e) {
        console.error("Failed to add to ledger:", e);
      }
    }

    // Open folder (optional, maybe user doesn't want this every time now that we have a browser? 
    // But user didn't say to remove it. "When an audio record is 'saved' (user presses save), you will create an entry")
    // I'll keep the folder opening for now as it's useful feedback.
    if (recordedFolderPath) {
      invoke('plugin:opener|open_path', { path: recordedFolderPath }).catch(e => {
        console.error("Failed to open path:", e);
      });
    }

    // Reset state handled by ReviewScreen exit or we can force it here?
    // ReviewScreen calls onExit after animation.
  };

  const handleDiscard = async () => {
    if (recordedFilePath) {
      try {
        await invoke('delete_recording_command', { path: recordedFilePath });
      } catch (e) {
        console.error("Failed to delete recording:", e);
        throw e;
      }
    }
  };

  const handleReviewExit = () => {
    resetState();
    // setHomeView('recordings'); // No longer switching view
    handleOpenRecordings();
  };

  const handleOpenRecordings = async () => {
    const label = 'recordings';
    const windows = await getAllWebviewWindows();
    const existing = windows.find(w => w.label === label);

    if (existing) {
      await existing.show();
      await existing.setFocus();
    }
  };

  const resetState = () => {
    setStep('home');
    setSelectedPid(null);
    setFilename('');
    setMicDevice(null);
    setRecordedFilePath('');
    setRecordedFolderPath('');
    setIsPaused(false);
  };

  return (
    <div className="h-screen w-screen bg-neutral-700/70 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col text-white select-none">
      <TitleBar isConnected={isConnected} />

      <div className="flex-1 flex flex-col px-5 pb-3 pt-0.5 overflow-hidden">
        {step === 'home' && (
          <>
            <div className="flex flex-col items-center justify-center gap-1 mb-4.5">
              <img src={logo} alt="Scriberr" className="h-6 w-auto opacity-100" />
              <span className="text-[8px] font-bold tracking-[0.3em] text-white/40 font-sans">
                COMPANION
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex-1 overflow-y-auto flex flex-col">
                <AppSelector
                  selectedPid={selectedPid}
                  onSelect={handleAppSelect}
                  disabled={false}
                />
              </div>

              <div className="mt-auto pt-2 flex items-center gap-3 justify-end">
                {selectedPid && (
                  <button
                    onClick={handleNewRecordingClick}
                    className="flex-1 bg-white/10 hover:bg-white/20 border border-white/10 text-white text-sm font-medium rounded-xl py-3 transition-all active:scale-[0.98] shadow-lg backdrop-blur-md"
                  >
                    New Recording
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={handleOpenRecordings}
                    className="text-white/40 hover:text-white/90 transition-colors p-2 rounded-lg"
                    title="Recordings"
                  >
                    <Folder size={20} />
                  </button>

                  <button
                    onClick={() => setStep('settings')}
                    className="text-white/40 hover:text-white/90 transition-colors p-2 rounded-lg"
                    title="Settings"
                  >
                    <Settings size={20} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 'setup' && (
          <SetupScreen
            onStart={handleStartRecording}
            onBack={() => setStep('home')}
            includeNone={selectedPid !== -1}
          />
        )}

        {step === 'recording' && (
          <RecordingScreen
            isPaused={isPaused}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
          />
        )}

        {step === 'review' && (
          <ReviewScreen
            initialFilename={filename}
            filePath={recordedFilePath}
            onSave={handleSave}
            onDiscard={handleDiscard}
            onExit={handleReviewExit}
          />
        )}

        {step === 'settings' && (
          <SettingsScreen
            onBack={() => setStep('home')}
          />
        )}
      </div>
    </div>
  );
}

export default App;
