import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { DashboardWindow } from './features/dashboard/DashboardWindow';
import { Toaster } from 'sonner';

import { useSettings } from './features/settings/api/useSettings';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

function Main() {
  const { data: settings, isLoading, refetch } = useSettings();
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    if (settings && settings.scriberr_url && settings.api_key) {
      setIsOnboarded(true);
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-stone-950 flex items-center justify-center text-white/20">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  // If we have settings or have just finished onboarding, show dashboard
  if (isOnboarded) {
    return <DashboardWindow />;
  }

  return <OnboardingScreen onComplete={() => {
    refetch(); // Reload settings to ensure we get the latest
    setIsOnboarded(true);
  }} />;
}

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <>
        <Main />
        <Toaster theme="dark" position="bottom-right" richColors />
      </>
    </QueryClientProvider>
  </StrictMode>,
)
