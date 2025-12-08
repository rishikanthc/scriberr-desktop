
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactElement; // Must be a single element to attach events
    delay?: number;
    side?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
}

export const Tooltip = ({ content, children, delay = 0, side = 'top', className = '' }: TooltipProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const triggerRef = useRef<HTMLElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                let x = 0;
                let y = 0;
                const gap = 8; // increased gap

                // Measure tooltip size approximately or just center using translate
                // For precise positioning we usually need to measure tooltip after render, but let's try CSS centering first.

                switch (side) {
                    case 'top':
                        x = rect.left + rect.width / 2;
                        y = rect.top - gap;
                        break;
                    case 'bottom':
                        x = rect.left + rect.width / 2;
                        y = rect.bottom + gap;
                        break;
                    case 'left':
                        x = rect.left - gap;
                        y = rect.top + rect.height / 2;
                        break;
                    case 'right':
                        x = rect.right + gap;
                        y = rect.top + rect.height / 2;
                        break;
                }

                setCoords({ x, y });
                setIsVisible(true);
            }
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsVisible(false);
    };

    // Clean up
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <>
            {/* Safe clone with event handlers */}
            {React.cloneElement(children as React.ReactElement<any>, {
                ref: triggerRef,
                onMouseEnter: handleMouseEnter,
                onMouseLeave: handleMouseLeave,
            })}
            {isVisible && createPortal(
                <div
                    className={`fixed z-[9999] pointer-events-none px-2.5 py-1.5 rounded-lg bg-neutral-900/95 backdrop-blur-md border border-white/10 text-xs font-medium text-white shadow-xl animate-in fade-in zoom-in-95 duration-100 ${className}`}
                    style={{
                        top: coords.y,
                        left: coords.x,
                        transform:
                            side === 'top' ? 'translate(-50%, -100%)' :
                                side === 'bottom' ? 'translate(-50%, 0)' :
                                    side === 'left' ? 'translate(-100%, -50%)' :
                                        'translate(0, -50%)'
                    }}
                >
                    {content}
                </div>,
                document.body
            )}
        </>
    );
};
