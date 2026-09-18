/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, Share2, Check, Sparkles } from 'lucide-react';
import { BALL_PALETTE } from './LotteryMachine';
import { generateShareSummary, shareOrCopy } from '../utils/shareSummary';

interface ResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    numbers: number[];
    target: number;
    min: number;
    max: number;
    poolName?: string;
    machineType: 'mechanical' | 'blower';
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
    isOpen, onClose, numbers, target, min, max, poolName, machineType,
}) => {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) setCopied(false);
    }, [isOpen]);

    if (!isOpen || numbers.length === 0) return null;

    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((a, b) => a + b, 0);
    const avg = (sum / numbers.length).toFixed(1);
    const oddCount = numbers.filter((n) => n % 2 !== 0).length;
    const evenCount = numbers.length - oddCount;

    const handleShare = async () => {
        const summary = generateShareSummary({ numbers, target, min, max, poolName, machineType });
        const ok = await shareOrCopy(summary);
        if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2200);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-xl p-5 flex flex-col gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                            {poolName || `${min}–${max}`}
                        </span>
                        <span className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            Draw Complete
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2.5 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                    {numbers.map((num, idx) => {
                        const pIndex = (num - 1) % BALL_PALETTE.length;
                        const theme = BALL_PALETTE[pIndex >= 0 ? pIndex : 0];
                        return (
                            <div
                                key={`result-${idx}-${num}`}
                                className="flex items-center justify-center w-11 h-11 rounded-full shadow-sm select-none"
                                style={{ background: theme.bg }}
                            >
                                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                                    <span className="font-extrabold text-xs text-neutral-900 leading-none">{num}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-neutral-500 px-1">
                    <span>Sorted: {sorted.join(', ')}</span>
                    <span>Sum {sum} · Avg {avg} · Odd {oddCount} / Even {evenCount}</span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-neutral-100">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-neutral-300 text-neutral-700 cursor-pointer"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleShare}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${copied ? 'bg-emerald-600 text-white' : 'bg-neutral-900 text-white'
                            }`}
                    >
                        {copied ? (
                            <>
                                <Check className="w-3.5 h-3.5" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Share2 className="w-3.5 h-3.5" />
                                Share Result
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};