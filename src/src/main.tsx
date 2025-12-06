import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import './index.css'
import { DashboardWindow } from './features/dashboard/DashboardWindow';
import { RecorderWindow } from './features/recorder/RecorderWindow';

function Main() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(getCurrentWindow().label);
  }, []);

  if (!label) return null;

  if (label === 'recorder') {
    return <RecorderWindow />;
  }

  // Default to Dashboard for 'main'
  return <DashboardWindow />;
}

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Main />
    </QueryClientProvider>
  </StrictMode>,
)
