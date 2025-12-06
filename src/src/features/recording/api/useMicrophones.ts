import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

export const useMicrophones = () => {
    return useQuery({
        queryKey: ['microphones'],
        queryFn: async () => {
            const list = await invoke<[string, string][]>('get_microphones_command');
            return list.map(([id, name]) => ({ id, name }));
        },
    });
};
