/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
    useMemo,
    useCallback,
} from 'react';
import { Check, Trash2, X } from 'lucide-react';

const ALL_NUMBERS = Array.from(
    { length: 90 },
    (_, i) => i + 1
);

interface NumberGridPickerProps {
    isOpen: boolean;
    numbers: number[];
    onChange: (numbers: number[]) => void;
    onClose: () => void;
}

export const NumberGridPicker: React.FC<
    NumberGridPickerProps
> = ({
    isOpen,
    numbers,
    onChange,
    onClose,
}) => {
        const counts = useMemo(() => {
            const result: Record<number, number> = {};

            for (const number of numbers) {
                result[number] =
                    (result[number] || 0) + 1;
            }

            return result;
        }, [numbers]);

        const addOne = useCallback(
            (number: number) => {
                onChange([
                    ...numbers,
                    number,
                ]);
            },
            [numbers, onChange]
        );

        const removeOne = useCallback(
            (number: number) => {
                const index =
                    numbers.indexOf(number);

                if (index === -1) return;

                const next = [...numbers];

                next.splice(index, 1);

                onChange(next);
            },
            [numbers, onChange]
        );

        if (!isOpen) return null;

        return (
            <div
                className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:p-4"
                onClick={onClose}
            >
                <div
                    className="w-full sm:max-w-xl bg-white sm:rounded-2xl rounded-t-3xl border border-neutral-200 shadow-2xl overflow-hidden"
                    onClick={(event) =>
                        event.stopPropagation()
                    }
                >
                    {/* Header */}

                    <div className="px-5 pt-4 pb-3 border-b border-neutral-200">
                        <div className="flex justify-center mb-3">
                            <div className="w-10 h-1 rounded-full bg-neutral-300" />
                        </div>

                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-neutral-900">
                                    Pick numbers
                                </h2>

                                <p className="text-xs text-neutral-400 mt-1">
                                    Click to add • Right-click to
                                    remove one
                                </p>
                            </div>

                            <div className="flex items-center gap-1 text-sm font-black text-neutral-900">
                                <Check className="w-4 h-4" />
                                {numbers.length}
                            </div>
                        </div>
                    </div>

                    {/* Grid */}

                    <div className="max-h-[52vh] overflow-y-auto px-4 py-4">
                        <div className="grid grid-cols-7 sm:grid-cols-9 gap-2">
                            {ALL_NUMBERS.map((number) => {
                                const count =
                                    counts[number] || 0;

                                const active =
                                    count > 0;

                                return (
                                    <button
                                        key={number}
                                        type="button"
                                        onClick={() =>
                                            addOne(number)
                                        }
                                        onContextMenu={(event) => {
                                            event.preventDefault();
                                            removeOne(number);
                                        }}
                                        className={`
                    relative aspect-square
                    rounded-full
                    flex items-center justify-center
                    text-xs sm:text-sm
                    font-extrabold
                    border
                    transition-all
                    select-none
                    ${active
                                                ? 'bg-neutral-900 text-white border-neutral-900 scale-[1.03]'
                                                : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-900 hover:bg-neutral-50'
                                            }
                  `}
                                        title={
                                            active
                                                ? 'Click to add another • Right-click to remove'
                                                : 'Click to add'
                                        }
                                    >
                                        {number}

                                        {count > 1 && (
                                            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-neutral-900 text-white border border-white text-[8px] flex items-center justify-center font-black">
                                                ×{count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}

                    <div className="flex gap-2 px-5 py-4 border-t border-neutral-200 bg-neutral-50">
                        <button
                            type="button"
                            onClick={() => onChange([])}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-100"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear all
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-[2] flex items-center justify-center gap-1.5 py-3 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800"
                        >
                            <Check className="w-4 h-4" />
                            Done
                        </button>
                    </div>
                </div>
            </div>
        );
    };