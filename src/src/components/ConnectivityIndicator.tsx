import clsx from 'clsx';

interface ConnectivityIndicatorProps {
    isConnected: boolean;
    className?: string;
}

export function ConnectivityIndicator({ isConnected, className }: ConnectivityIndicatorProps) {
    return (
        <div
            className={clsx("flex items-center gap-1.5 select-none", className)}
            title={isConnected ? "Connected to Scriberr" : "Not Connected"}
        >
            <div
                className={clsx(
                    "w-2 h-2 rounded-full transition-all duration-500",
                    isConnected
                        ? "bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                        : "bg-red-500/50"
                )}
            />
            {/* Optional text label if needed, but user just said indicator */}
        </div>
    );
}
