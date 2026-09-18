/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { X, Plus, Trash2, Check, Layers, AlertCircle } from 'lucide-react';
import { CustomPool } from '../types';
import { parseCustomNumbers } from '../data/pools';

interface PoolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedPools: CustomPool[];
  activePoolId: string;
  onSelectPool: (pool: CustomPool) => void;
  onSaveNewPool: (newPool: CustomPool) => void;
  onDeletePool: (poolId: string) => void;
}

export const PoolsModal: React.FC<PoolsModalProps> = ({ isOpen, onClose, savedPools, activePoolId, onSelectPool, onSaveNewPool, onDeletePool }) => {
  const [tab, setTab] = useState<'select' | 'create'>('select');
  const [poolType, setPoolType] = useState<'custom_list' | 'range'>('range');
  const [name, setName] = useState('');
  const [rawNumbers, setRawNumbers] = useState('7, 14, 21, 28, 35, 42, 49');
  const [rangeMin, setRangeMin] = useState(1);
  const [rangeMax, setRangeMax] = useState(40);
  const [numbersToPick, setNumbersToPick] = useState(5);
  const [validationError, setValidationError] = useState<string | null>(null);

  const parsedNumbers = useMemo(() => {
    if (poolType === 'range') {
      const lo = Math.min(rangeMin, rangeMax), hi = Math.max(rangeMin, rangeMax);
      const arr: number[] = [];
      for (let i = lo; i <= hi; i++) arr.push(i);
      return arr;
    }
    return parseCustomNumbers(rawNumbers);
  }, [poolType, rawNumbers, rangeMin, rangeMax]);

  useEffect(() => {
    if (parsedNumbers.length > 0 && numbersToPick > parsedNumbers.length) {
      setNumbersToPick(Math.max(1, Math.min(6, parsedNumbers.length)));
    }
  }, [parsedNumbers.length, numbersToPick]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (parsedNumbers.length < 2) { setValidationError('Pool needs at least 2 numbers.'); return }
    if (numbersToPick < 1 || numbersToPick > parsedNumbers.length) { setValidationError(`Pick count must be between 1 and ${parsedNumbers.length}.`); return }

    const minVal = Math.min(...parsedNumbers), maxVal = Math.max(...parsedNumbers);
    const newPool: CustomPool = {
      id: `custom-${Date.now()}`,
      name: name.trim() || `Custom (${parsedNumbers.length})`,
      type: poolType,
      min: minVal,
      max: maxVal,
      customNumbers: poolType === 'custom_list' ? parsedNumbers : undefined,
      numbersToPick,
      description: poolType === 'custom_list' ? `${parsedNumbers.length} numbers • Pick ${numbersToPick}` : `${minVal} to ${maxVal} • Pick ${numbersToPick}`,
      isPreset: false,
      createdAt: Date.now(),
    };
    onSaveNewPool(newPool);
    onSelectPool(newPool);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl border border-neutral-300 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <div className="flex items-center gap-2 font-semibold text-neutral-900">
            <Layers className="w-4 h-4" /> Pools
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex border-b border-neutral-200 px-5 gap-4">
          <button onClick={() => setTab('select')} className={`py-2.5 text-xs font-semibold border-b-2 cursor-pointer ${tab === 'select' ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400'}`}>Select</button>
          <button onClick={() => setTab('create')} className={`py-2.5 text-xs font-semibold border-b-2 cursor-pointer ${tab === 'create' ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400'}`}>Create</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {tab === 'select' ? (
            <div className="flex flex-col gap-2">
              {savedPools.map((pool) => {
                const isActive = pool.id === activePoolId;
                return (
                  <div key={pool.id} className={`flex items-center justify-between p-3 rounded-lg border ${isActive ? 'border-neutral-900' : 'border-neutral-200'}`}>
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900">
                        {pool.name}
                        {isActive && <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-neutral-900 text-white"><Check className="w-3 h-3" />Active</span>}
                      </div>
                      <p className="text-[11px] text-neutral-400">{pool.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isActive && (
                        <button onClick={() => { onSelectPool(pool); onClose() }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 text-white cursor-pointer">Load</button>
                      )}
                      {!pool.isPreset && (
                        <button onClick={() => onDeletePool(pool.id)} className="p-1.5 text-neutral-400 hover:text-neutral-900 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Pool Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office Raffle" className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm" maxLength={40} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPoolType('range')} className={`p-2.5 rounded-lg border text-left text-xs font-semibold cursor-pointer ${poolType === 'range' ? 'border-neutral-900' : 'border-neutral-200 text-neutral-500'}`}>Range</button>
                <button type="button" onClick={() => setPoolType('custom_list')} className={`p-2.5 rounded-lg border text-left text-xs font-semibold cursor-pointer ${poolType === 'custom_list' ? 'border-neutral-900' : 'border-neutral-200 text-neutral-500'}`}>Custom list</button>
              </div>

              {poolType === 'range' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Min</label>
                    <input type="number" value={rangeMin} onChange={(e) => setRangeMin(Math.max(1, Number(e.target.value)))} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Max</label>
                    <input type="number" value={rangeMax} onChange={(e) => setRangeMax(Math.max(rangeMin + 1, Number(e.target.value)))} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
                  </div>
                </div>
              ) : (
                <textarea rows={3} value={rawNumbers} onChange={(e) => setRawNumbers(e.target.value)} placeholder="3, 7, 12, 19, 23" className="w-full p-3 rounded-lg border border-neutral-300 text-xs font-mono resize-none" />
              )}

              <div className="flex items-center justify-between p-3 rounded-lg border border-neutral-200">
                <span className="text-xs font-semibold text-neutral-700">Balls to draw</span>
                <input type="number" min={1} max={Math.max(1, parsedNumbers.length)} value={numbersToPick} onChange={(e) => setNumbersToPick(Math.max(1, Math.min(parsedNumbers.length || 1, Number(e.target.value))))} className="w-16 text-center text-sm font-bold py-1 px-2 rounded-lg border border-neutral-300" />
              </div>

              <p className="text-[11px] text-neutral-400">{parsedNumbers.length} numbers in pool</p>

              {validationError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-100 border border-neutral-300 text-neutral-800 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {validationError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-600 cursor-pointer">Cancel</button>
                <button type="submit" disabled={parsedNumbers.length < 2} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-neutral-900 text-white disabled:opacity-40 cursor-pointer">
                  <Plus className="w-4 h-4" /> Save & Load
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};