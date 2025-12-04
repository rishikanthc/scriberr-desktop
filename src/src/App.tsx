import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TitleBar } from './components/TitleBar';
import { AppSelector } from './components/AppSelector';
import { SetupScreen } from './components/SetupScreen';
import { RecordingScreen } from './components/RecordingScreen';
import { ReviewScreen } from './components/ReviewScreen';
import logo from './assets/logo.svg';

type AppStep = 'home' | 'setup' | 'recording' | 'review';

function App() {
  const [step, setStep] = useState<AppStep>('home');
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [filename, setFilename] = useState('');
  const [micDevice, setMicDevice] = useState<string | null>(null);
  const [recordedFilePath, setRecordedFilePath] = useState('');
  const [recordedFolderPath, setRecordedFolderPath] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  const handleAppSelect = (pid: number) => {
    if (selectedPid === pid) {
      // If already selected, maybe just go to setup?
      // Or toggle selection.
      // User said: "After I pick an app... show a button for new recording"
      // Let's keep selection logic, and show button if selected.
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
    if (!selectedPid) return;
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
    // Open folder
    if (recordedFolderPath) {
      // Fire and forget to prevent blocking the UI if opener hangs
      invoke('plugin:opener|open_path', { path: recordedFolderPath }).catch(e => {
        console.error("Failed to open path:", e);
      });
    }
    // Do not reset state here, let ReviewScreen handle it after animation
  };

  const handleDiscard = async () => {
    if (recordedFilePath) {
      try {
        await invoke('delete_recording_command', { path: recordedFilePath });
      } catch (e) {
        console.error("Failed to delete recording:", e);
        // Throw so ReviewScreen knows it failed? Or just swallow?
        // User wants to know success/failure.
        throw e;
      }
    }
  };

  const handleReviewExit = () => {
    resetState();
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
      <TitleBar />

      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {step === 'home' && (
          <>
            <div className="flex flex-col items-center justify-center gap-1 mb-6">
              <img src={logo} alt="Scriberr" className="h-8 w-auto opacity-100" />
              <span className="text-[10px] font-bold tracking-[0.3em] text-white/40 font-sans">
                COMPANION
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <AppSelector
                  selectedPid={selectedPid}
                  onSelect={handleAppSelect}
                  disabled={false}
                />
              </div>

              {selectedPid && (
                <button
                  onClick={handleNewRecordingClick}
                  className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white font-medium rounded-xl py-4 transition-all active:scale-[0.98] shadow-lg backdrop-blur-md"
                >
                  New Recording
                </button>
              )}
            </div>
          </>
        )}

        {step === 'setup' && (
          <SetupScreen
            onStart={handleStartRecording}
            onBack={() => setStep('home')}
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
      </div>
    </div>
  );
}

export default App;
