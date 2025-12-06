import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

export const useMicrophones = () => {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['microphones'],
        queryFn: async () => {
            const list = await invoke<[string, string][]>('get_microphones_command');
            return list.map(([id, name]) => ({ id, name }));
        },
    });

    const switchMicMutation = useMutation({
        mutationFn: async (deviceName: string) => {
            await invoke('switch_microphone_command', { deviceName });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['microphones'] });
        }
    });

    return {
        ...query,
        switchMicMutation
    };
};
