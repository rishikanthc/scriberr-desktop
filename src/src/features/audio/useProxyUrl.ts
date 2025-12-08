import { useMemo } from 'react';
import { useProxyContext } from './ProxyContext';

export function useProxyUrl(jobId: string | undefined) {
    const { proxyPort } = useProxyContext();

    return useMemo(() => {
        if (!jobId || !proxyPort) return undefined;
        return `http://127.0.0.1:${proxyPort}/stream/${jobId}`;
    }, [jobId, proxyPort]);
}
