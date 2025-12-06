import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { RunnableApp } from '../../../types';

export const useApps = () => {
    return useQuery({
        queryKey: ['apps'],
        queryFn: async () => {
            // ensure invoke returns what we expect or cast it
            return await invoke<RunnableApp[]>('get_apps');
        },
        refetchInterval: 5000,
    });
};
