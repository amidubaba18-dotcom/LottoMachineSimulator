/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useCallback } from 'react';
import { LotteryMachine } from './components/LotteryMachine';
import { Controls } from './components/Controls';
import { ResultsModal } from './components/ResultsModal';
import { HistoryLog } from './components/HistoryLog';
import { PoolsModal } from './components/PoolsModal';
import { InstallPromptButton } from './components/InstallPromptButton';
import { LotteryMachineHandle, DrawHistoryRecord, CustomPool } from './types';
import { loadSavedPools, persistCustomPools, DEFAULT_PRESET_POOLS } from './data/pools';
import { Dices, Layers } from 'lucide-react';

const STORAGE_KEY = 'lottery_machine_draw_history';
const AUTO_RESET_DELAY_MS = 900;

export default function App() {
  const machineRef = useRef<LotteryMachineHandle | null>(null);
  const autoResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [savedPools, setSavedPools] = useState<CustomPool[]>(() => loadSavedPools());
  const [activePool, setActivePool] = useState<CustomPool>(() => {
    const loaded = loadSavedPools();
    return loaded[0] || DEFAULT_PRESET_POOLS[0];
  });
  const [customNumbers, setCustomNumbers] = useState<number[] | undefined>(() => activePool.customNumbers);
  const [isPoolsModalOpen, setIsPoolsModalOpen] = useState(false);

  const [min, setMin] = useState(() => activePool.min);
  const [max, setMax] = useState(() => activePool.max);
  const [numbersToPick, setNumbersToPick] = useState(() => activePool.numbersToPick);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [machineType, setMachineType] = useState<'mechanical' | 'blower'>('mechanical');

  const [resultsOpen, setResultsOpen] = useState(false);
  const [lastDraw, setLastDraw] = useState<number[]>([]);

  const [history, setHistory] = useState<DrawHistoryRecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { console.warn('Failed to parse history:', e) }
    return [];
  });

  const lastRecordedDrawRef = useRef<string>('');

  const clearAutoResetTimeout = useCallback(() => {
    if (autoResetTimeoutRef.current !== null) {
      clearTimeout(autoResetTimeoutRef.current);
      autoResetTimeoutRef.current = null;
    }
  }, []);

  const saveDrawToHistory = useCallback((numbers: number[]) => {
    if (numbers.length === 0) return;
    const signature = `${numbers.join(',')}-${min}-${max}-${machineType}-${activePool.id}`;
    if (lastRecordedDrawRef.current === signature) return;
    lastRecordedDrawRef.current = signature;

    const newRecord: DrawHistoryRecord = {
      id: `draw-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      numbers: [...numbers],
      min, max, numbersToPick, machineType,
      poolName: activePool.name,
    };

    setHistory((prev) => {
      const updated = [newRecord, ...prev];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 100))) } catch (e) { console.warn(e) }
      return updated;
    });
  }, [min, max, numbersToPick, machineType, activePool.id, activePool.name]);

  const handleSelectPool = useCallback((pool: CustomPool) => {
    clearAutoResetTimeout();
    setActivePool(pool);
    setMin(pool.min);
    setMax(pool.max);
    setCustomNumbers(pool.customNumbers);
    setNumbersToPick(pool.numbersToPick);
    setDrawnNumbers([]);
    setIsDrawing(false);
    setResultsOpen(false);
    machineRef.current?.reset();
  }, [clearAutoResetTimeout]);

  const handleSaveNewPool = useCallback((newPool: CustomPool) => {
    setSavedPools((prev) => {
      const updated = [newPool, ...prev.filter((p) => p.id !== newPool.id)];
      persistCustomPools(updated);
      return updated;
    });
  }, []);

  const handleDeletePool = useCallback((poolId: string) => {
    setSavedPools((prev) => {
      const updated = prev.filter((p) => p.id !== poolId);
      persistCustomPools(updated);
      return updated;
    });
    if (activePool.id === poolId) handleSelectPool(DEFAULT_PRESET_POOLS[0]);
  }, [activePool.id, handleSelectPool]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    try { localStorage.removeItem(STORAGE_KEY) } catch (e) { console.warn(e) }
  }, []);

  const handleDeleteRecord = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) } catch (e) { console.warn(e) }
      return updated;
    });
  }, []);

  const handleBallDrawn = useCallback((ballValue: number) => {
    setDrawnNumbers((prev) => {
      if (prev.includes(ballValue)) return prev;
      const next = [...prev, ballValue];
      if (next.length >= numbersToPick) {
        setIsDrawing(false);
        saveDrawToHistory(next);
        setLastDraw(next);
        setResultsOpen(true);
        clearAutoResetTimeout();
        autoResetTimeoutRef.current = setTimeout(() => {
          setDrawnNumbers([]);
          machineRef.current?.reset();
          autoResetTimeoutRef.current = null;
        }, AUTO_RESET_DELAY_MS);
      }
      return next;
    });
  }, [numbersToPick, saveDrawToHistory, clearAutoResetTimeout]);

  const handleDrawAll = () => { if (machineRef.current) { setIsDrawing(true); machineRef.current.draw() } };

  const handleReset = useCallback(() => {
    clearAutoResetTimeout();
    setIsDrawing(false);
    setDrawnNumbers([]);
    setResultsOpen(false);
    setNumbersToPick(activePool.numbersToPick);
    machineRef.current?.reset();
  }, [clearAutoResetTimeout, activePool.numbersToPick]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans">
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Dices className="w-5 h-5" />
          Lotto Wheel
        </div>
        <div className="flex items-center gap-2">
          <InstallPromptButton />
          <button
            onClick={() => setIsPoolsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            Pools
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 flex flex-col items-center gap-6">
        <div className="w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
          <div className="p-2 rounded-2xl bg-white border border-neutral-200">
            <LotteryMachine
              ref={machineRef}
              min={min}
              max={max}
              customNumbers={customNumbers}
              numbersToPick={numbersToPick}
              drawnNumbers={drawnNumbers}
              onBallDrawn={handleBallDrawn}
              speedMultiplier={speedMultiplier}
              soundEnabled={soundEnabled}
              machineType={machineType}
            />
          </div>

          <div className="flex flex-col gap-4 w-full max-w-md">
            <Controls
              onDrawAll={handleDrawAll}
              onReset={handleReset}
              isDrawing={isDrawing}
              drawnCount={drawnNumbers.length}
              numbersToPick={numbersToPick}
              maxNumbersToPick={Math.min(30, max - min + 1)}
              onNumbersToPickChange={setNumbersToPick}
              activePool={activePool}
              speedMultiplier={speedMultiplier}
              onSpeedChange={setSpeedMultiplier}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled((prev) => !prev)}
              machineType={machineType}
              onMachineTypeChange={setMachineType}
            />
          </div>
        </div>

        <HistoryLog history={history} onClearHistory={handleClearHistory} onDeleteRecord={handleDeleteRecord} />
      </main>

      <ResultsModal
        isOpen={resultsOpen}
        onClose={() => setResultsOpen(false)}
        numbers={lastDraw}
        target={numbersToPick}
        min={min}
        max={max}
        poolName={activePool.name}
        machineType={machineType}
      />

      <PoolsModal
        isOpen={isPoolsModalOpen}
        onClose={() => setIsPoolsModalOpen(false)}
        savedPools={savedPools}
        activePoolId={activePool.id}
        onSelectPool={handleSelectPool}
        onSaveNewPool={handleSaveNewPool}
        onDeletePool={handleDeletePool}
      />
    </div>
  );
}