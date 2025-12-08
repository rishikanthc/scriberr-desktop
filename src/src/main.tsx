import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { DashboardWindow } from './features/dashboard/DashboardWindow';
import { Toaster } from 'sonner';

import { useSettings } from './features/settings/api/useSettings';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { Loader2 } from 'lucide-react';


function Main() {
  const { data: settings, isLoading, refetch } = useSettings();

  // Derive state directly from data - distinct from "syncing" state
  const isConfigured = Boolean(settings?.scriberr_url && settings?.api_key);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-stone-950 flex items-center justify-center text-white/20">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  // If we have settings, show dashboard
  if (isConfigured) {
    return <DashboardWindow />;
  }

  return <OnboardingScreen onComplete={() => {
    refetch(); // Reload settings to ensure we get the latest
  }} />;
}

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { ProxyContextProvider } from './features/audio/ProxyContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ProxyContextProvider>
        <Main />
        <Toaster theme="dark" position="bottom-right" richColors />
      </ProxyContextProvider>
    </QueryClientProvider>
  </StrictMode>,
)
