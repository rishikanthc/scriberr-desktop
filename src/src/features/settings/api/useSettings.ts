import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { Settings } from '../../../types';

export const useSettings = () => {
    return useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            return await invoke<Settings>('load_settings_command');
        },
    });
};

export const useSaveSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (settings: Settings) => {
            await invoke('save_settings_command', { settings });
        },
        onSuccess: (_data, variables) => {
            // Update cache immediately
            queryClient.setQueryData(['settings'], variables);
        },
    });
};

export const useTestConnection = () => {
    return useMutation({
        mutationFn: async (credentials: { url: string; apiKey: string }) => {
            return await invoke<boolean>('check_connection_command', {
                url: credentials.url,
                apiKey: credentials.apiKey
            });
        },
    });
};
export const useConnectivity = () => {
    return useQuery({
        queryKey: ['connectivity'],
        queryFn: async () => {
            const settings = await invoke<Settings>('load_settings_command');
            if (settings.scriberr_url && settings.api_key) {
                return await invoke<boolean>('check_connection_command', {
                    url: settings.scriberr_url,
                    apiKey: settings.api_key
                });
            }
            return false;
        },
        refetchInterval: 30000,
        retry: false,
    });
};
