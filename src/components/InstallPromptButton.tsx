/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const isIos = () =>
    /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

const isInStandaloneMode = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

export const InstallPromptButton: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showIosHint, setShowIosHint] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isInStandaloneMode()) return; // already installed, don't show anything

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setVisible(true);
        };
        window.addEventListener('beforeinstallprompt', handler);

        // iOS never fires beforeinstallprompt — surface our own manual hint instead
        if (isIos()) setVisible(true);

        const installedHandler = () => {
            setVisible(false);
            setDeferredPrompt(null);
        };
        window.addEventListener('appinstalled', installedHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installedHandler);
        };
    }, []);

    const handleClick = useCallback(async () => {
        if (isIos()) {
            setShowIosHint(true);
            return;
        }
        if (!deferredPrompt) return;

        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        // outcome is 'accepted' or 'dismissed' — a prompt can only be used once
        setDeferredPrompt(null);
        if (outcome === 'accepted') setVisible(false);
    }, [deferredPrompt]);

    if (!visible) return null;

    return (
        <>
            <button
                onClick={handleClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold cursor-pointer"
            >
                <Download className="w-4 h-4" />
                Install App
            </button>

            {showIosHint && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-sm"
                    onClick={() => setShowIosHint(false)}
                >
                    <div
                        className="w-full max-w-sm bg-white rounded-2xl border border-neutral-200 shadow-xl p-5 flex flex-col gap-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-neutral-900">Install this app</span>
                            <button onClick={() => setShowIosHint(false)} className="p-1 text-neutral-400 hover:text-neutral-900 cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-neutral-600 leading-relaxed flex items-center gap-1.5 flex-wrap">
                            Tap the <Share className="w-3.5 h-3.5 inline" /> Share button in Safari's toolbar, then choose
                            <span className="font-semibold text-neutral-900">&ldquo;Add to Home Screen&rdquo;</span>.
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};