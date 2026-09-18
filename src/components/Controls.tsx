/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Zap, RotateCcw, Volume2, VolumeX, Disc3, Wind, Hash } from 'lucide-react';
import { CustomPool } from '../types';

interface ControlsProps {
  onDrawAll: () => void;
  onReset: () => void;
  isDrawing: boolean;
  drawnCount: number;
  numbersToPick: number;
  maxNumbersToPick: number;
  onNumbersToPickChange: (val: number) => void;
  activePool: CustomPool;
  speedMultiplier: number;
  onSpeedChange: (val: number) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  machineType: 'mechanical' | 'blower';
  onMachineTypeChange: (type: 'mechanical' | 'blower') => void;
}

export const Controls: React.FC<ControlsProps> = ({
  onDrawAll, onReset, isDrawing, drawnCount, numbersToPick, maxNumbersToPick,
  onNumbersToPickChange, activePool, speedMultiplier, onSpeedChange, soundEnabled,
  onToggleSound, machineType, onMachineTypeChange,
}) => {
  const isComplete = drawnCount >= numbersToPick;
  const canChangeCount = !isDrawing && drawnCount === 0;

  const clamp = (val: number) => Math.min(Math.max(val, 1), maxNumbersToPick);

  const handleInputChange = (raw: string) => {
    if (raw === '') return;
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    onNumbersToPickChange(clamp(parsed));
  };

  return (
    <div className="w-full max-w-md bg-white border border-neutral-300 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-neutral-600">
        <span className="font-semibold text-neutral-900">{activePool.name}</span>
        <span>{drawnCount} / {numbersToPick} picked</span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="flex items-center gap-1.5 text-neutral-500 font-medium text-xs">
            <Hash className="w-3.5 h-3.5" />
            Numbers to Draw
          </label>
          <span className="text-[10px] text-neutral-400">up to {maxNumbersToPick}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={maxNumbersToPick}
            value={numbersToPick}
            disabled={!canChangeCount}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={(e) => onNumbersToPickChange(clamp(Number(e.target.value) || 1))}
            className="w-20 bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <input
            type="range"
            min={1}
            max={maxNumbersToPick}
            value={numbersToPick}
            disabled={!canChangeCount}
            onChange={(e) => onNumbersToPickChange(Number(e.target.value))}
            className="flex-1 accent-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onDrawAll}
          disabled={isDrawing || isComplete}
          className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold bg-neutral-900 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Zap className="w-4 h-4" />
          Draw All
        </button>
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold border border-neutral-300 text-neutral-700 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>

      <div className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 text-xs">
        <span className="font-semibold text-neutral-600 flex items-center gap-1.5">
          <Disc3 className="w-3.5 h-3.5" />
          Mechanism
        </span>
        <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden">
          <button
            onClick={() => onMachineTypeChange('mechanical')}
            className={`px-2.5 py-1 font-medium cursor-pointer ${machineType === 'mechanical' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}
          >
            Paddles
          </button>
          <button
            onClick={() => onMachineTypeChange('blower')}
            className={`flex items-center gap-1 px-2.5 py-1 font-medium cursor-pointer ${machineType === 'blower' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}
          >
            <Wind className="w-3.5 h-3.5" />
            Blower
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="block text-neutral-500 font-medium mb-1">Speed</label>
          <select
            value={speedMultiplier}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="w-full bg-white border border-neutral-300 rounded-lg px-2 py-1.5 font-semibold text-neutral-800"
          >
            <option value={0.75}>0.75x Slow</option>
            <option value={1}>1.0x Normal</option>
            <option value={1.5}>1.5x Fast</option>
            <option value={2}>2.0x Turbo</option>
          </select>
        </div>
        <div>
          <label className="block text-neutral-500 font-medium mb-1">Sound</label>
          <button
            onClick={onToggleSound}
            className="w-full flex items-center justify-center gap-1.5 border border-neutral-300 rounded-lg px-2 py-1.5 font-semibold text-neutral-800 cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {soundEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>
    </div>
  );
};