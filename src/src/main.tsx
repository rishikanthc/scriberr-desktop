import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { DashboardWindow } from './features/dashboard/DashboardWindow';
import { Toaster } from 'sonner';

function Main() {
  return <DashboardWindow />;
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
