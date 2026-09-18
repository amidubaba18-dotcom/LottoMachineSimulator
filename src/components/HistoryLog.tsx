/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { History, Trash2, Calendar, Disc3, Wind, Share2, Check } from 'lucide-react';
import { DrawHistoryRecord } from '../types';
import { BALL_PALETTE } from './LotteryMachine';
import { generateShareSummary, shareOrCopy } from '../utils/shareSummary';

interface HistoryLogProps {
  history: DrawHistoryRecord[];
  onClearHistory: () => void;
  onDeleteRecord: (id: string) => void;
}

export const HistoryLog: React.FC<HistoryLogProps> = ({ history, onClearHistory, onDeleteRecord }) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleShareRecord = async (record: DrawHistoryRecord) => {
    const summary = generateShareSummary({
      numbers: record.numbers,
      target: record.numbersToPick,
      min: record.min,
      max: record.max,
      poolName: record.poolName,
      machineType: record.machineType || 'mechanical',
    });
    const ok = await shareOrCopy(summary);
    if (ok) {
      setCopiedId(record.id);
      setTimeout(() => setCopiedId((cur) => (cur === record.id ? null : cur)), 2200);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-white border border-neutral-300 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <History className="w-4 h-4" />
          History ({history.length})
        </div>
        {history.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-neutral-600">Clear all?</span>
              <button onClick={() => { onClearHistory(); setConfirmClear(false) }} className="text-xs font-semibold px-2 py-1 rounded bg-neutral-900 text-white cursor-pointer">Yes</button>
              <button onClick={() => setConfirmClear(false)} className="text-xs font-semibold px-2 py-1 rounded border border-neutral-300 cursor-pointer">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )
        )}
      </div>

      {history.length === 0 ? (
        <div className="py-8 flex flex-col items-center text-center text-neutral-400 gap-2">
          <Calendar className="w-6 h-6" />
          <p className="text-xs">No draws yet.</p>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto flex flex-col divide-y divide-neutral-100">
          {history.map((record, idx) => (
            <div key={record.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5 min-w-[150px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-neutral-800">Draw #{history.length - idx}</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600">
                    {record.machineType === 'mechanical' ? <Disc3 className="w-3 h-3" /> : <Wind className="w-3 h-3" />}
                    {record.machineType === 'mechanical' ? 'Paddles' : 'Blower'}
                  </span>
                </div>
                <span className="text-[11px] text-neutral-400">{new Date(record.timestamp).toLocaleString()} • {record.poolName || `${record.min}–${record.max}`}</span>
              </div>

              <div className="flex flex-wrap gap-1.5 flex-1 justify-start sm:justify-center">
                {record.numbers.map((num, i) => {
                  const pIndex = (num - 1) % BALL_PALETTE.length;
                  const theme = BALL_PALETTE[pIndex >= 0 ? pIndex : 0];
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-center w-7 h-7 rounded-full shadow-sm select-none"
                      style={{ background: theme.bg }}
                    >
                      <div className="w-[18px] h-[18px] rounded-full bg-white flex items-center justify-center">
                        <span className="font-extrabold text-[9px] text-neutral-900 leading-none">{num}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => handleShareRecord(record)}
                  className="text-neutral-400 hover:text-neutral-900 cursor-pointer"
                  title="Share this draw"
                >
                  {copiedId === record.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                </button>
                <button onClick={() => onDeleteRecord(record.id)} className="text-neutral-400 hover:text-neutral-900 cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};