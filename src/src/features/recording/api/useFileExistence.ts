import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

// This is not exactly a hook but a check function could be wrapped.
// But mostly we check on filename change.
// So useQuery dependent on filename?
export const useFileExistence = (filename: string) => {
    return useQuery({
        queryKey: ['file_exists', filename],
        queryFn: async () => {
            if (!filename.trim()) return false;
            return await invoke<boolean>('check_file_exists_command', { filename });
        },
        enabled: !!filename.trim(),
        staleTime: 500, // cache for a bit
    });
};
