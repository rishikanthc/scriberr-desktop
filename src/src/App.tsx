import { useState, Suspense, lazy } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TitleBar } from './components/TitleBar';
import { AppSelector } from './features/recording/AppSelector';
import { ConnectivityIndicator } from './components/ConnectivityIndicator';
import { Settings, Folder, Loader2 } from 'lucide-react';


import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';

import { useConnectivity } from './features/settings/api/useSettings';
import { useRecordingControls } from './features/recording/api/useRecordingControls';

type AppStep = 'home' | 'setup' | 'recording' | 'review' | 'settings';

// Lazy load screens
const SetupScreen = lazy(() => import('./features/recording/SetupScreen').then(module => ({ default: module.SetupScreen })));
const RecordingScreen = lazy(() => import('./features/recording/RecordingScreen').then(module => ({ default: module.RecordingScreen })));
const ReviewScreen = lazy(() => import('./features/library/ReviewScreen').then(module => ({ default: module.ReviewScreen })));
const SettingsScreen = lazy(() => import('./features/settings/SettingsScreen').then(module => ({ default: module.SettingsScreen })));

function App() {
  const [step, setStep] = useState<AppStep>('home');
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [filename, setFilename] = useState('');
  const [recordedFilePath, setRecordedFilePath] = useState('');
  const [recordedFolderPath, setRecordedFolderPath] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const { data: isConnected = false } = useConnectivity();
  const { start, pause, resume, stop, deleteRecording, addToLedger } = useRecordingControls();

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

  const handleStartRecording = (name: string, mic: string | null) => {
    if (selectedPid === null) return;
    setFilename(name);
    start.mutate({
      pid: selectedPid,
      filename: name,
      micDevice: mic
    }, {
      onSuccess: () => {
        setStep('recording');
        setIsPaused(false);
      },
      onError: (error: Error) => {
        console.error('Failed to start recording:', error);
      }
    });
  };

  const handlePause = () => {
    pause.mutate(undefined, {
      onSuccess: () => setIsPaused(true),
      onError: (error: Error) => console.error('Failed to pause:', error)
    });
  };

  const handleResume = () => {
    resume.mutate(undefined, {
      onSuccess: () => setIsPaused(false),
      onError: (error: Error) => console.error('Failed to resume:', error)
    });
  };

  const handleStop = () => {
    stop.mutate(undefined, {
      onSuccess: (result: { file_path: string; folder_path: string; duration_sec: number }) => {
        setRecordedFilePath(result.file_path);
        setRecordedFolderPath(result.folder_path);
        setRecordingDuration(result.duration_sec);

        setStep('review');
        setIsPaused(false);
      },
      onError: (error: Error) => console.error('Failed to stop recording:', error)
    });
  };

  const handleSave = async () => {
    // Add to ledger
    if (recordedFilePath) {
      addToLedger.mutate({ filePath: recordedFilePath, durationSec: recordingDuration }, {
        onError: (e: Error) => console.error("Failed to add to ledger:", e)
      });
    }

    // Open folder
    if (recordedFolderPath) {
      invoke('plugin:opener|open_path', { path: recordedFolderPath }).catch((e: unknown) => {
        console.error("Failed to open path:", e);
      });
    }

    // Reset state handled by ReviewScreen exit
  };

  const handleDiscard = async () => {
    if (recordedFilePath) {
      await deleteRecording.mutateAsync(recordedFilePath);
    }
  };

  const handleReviewExit = async () => {
    resetState();
    // setHomeView('recordings'); // No longer switching view
    await handleOpenRecordings();
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
    setRecordedFilePath('');
    setRecordedFolderPath('');
    setIsPaused(false);
  };

  return (
    <div className="h-screen w-screen bg-stone-700/85 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col text-white select-none">
      <TitleBar variant="home" />

      <div className="flex-1 flex flex-col px-5 pb-3 pt-0.5 overflow-hidden">
        {step === 'home' && (
          <>
            {/* Logo removed */}

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

        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-white/20" size={32} />
          </div>
        }>
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
        </Suspense>
      </div>

      <div className="absolute bottom-3 right-3 pointer-events-none">
        <ConnectivityIndicator isConnected={isConnected} />
      </div>
    </div>
  );
}

export default App;
