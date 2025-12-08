import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ProxyContextType {
    proxyPort: number | null;
}

const ProxyContext = createContext<ProxyContextType | undefined>(undefined);

export function ProxyContextProvider({ children }: { children: ReactNode }) {
    const [proxyPort, setProxyPort] = useState<number | null>(null);

    useEffect(() => {
        invoke<number>('get_proxy_port_command')
            .then(port => {
                console.log("Audio Proxy Port:", port);
                setProxyPort(port);
            })
            .catch(err => console.error("Failed to get proxy port:", err));
    }, []);

    return (
        <ProxyContext.Provider value={{ proxyPort }}>
            {children}
        </ProxyContext.Provider>
    );
}

export function useProxyContext() {
    const context = useContext(ProxyContext);
    if (!context) throw new Error("useProxyContext must be used within ProxyContextProvider");
    return context;
}
