/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Disc3, Wind, Hash, SlidersHorizontal } from 'lucide-react';
import { CustomPool } from '../types';

interface ControlsProps {
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
  // Range: a temporary drawing-boundary filter over the pool. Never mutates the pool itself.
  rangeFrom: number;
  rangeTo: number;
  poolMin: number;
  poolMax: number;
  onRangeFromChange: (val: number) => void;
  onRangeToChange: (val: number) => void;
  rangedCount: number;
}

export const Controls: React.FC<ControlsProps> = ({
  isDrawing, drawnCount, numbersToPick, maxNumbersToPick,
  onNumbersToPickChange, activePool, speedMultiplier, onSpeedChange, soundEnabled,
  onToggleSound, machineType, onMachineTypeChange,
  rangeFrom, rangeTo, poolMin, poolMax, onRangeFromChange, onRangeToChange, rangedCount,
}) => {
  const canChangeCount = !isDrawing && drawnCount === 0;

  const clamp = (val: number) => Math.min(Math.max(val, 1), maxNumbersToPick);
  const clampRange = (val: number) => Math.min(Math.max(val, poolMin), poolMax);

  // Local text buffers let the inputs go empty / be selected-and-overtyped
  // while typing, without the parent's numeric state snapping them back.
  const [countText, setCountText] = useState(String(numbersToPick));
  const [fromText, setFromText] = useState(String(rangeFrom));
  const [toText, setToText] = useState(String(rangeTo));

  useEffect(() => setCountText(String(numbersToPick)), [numbersToPick]);
  useEffect(() => setFromText(String(rangeFrom)), [rangeFrom]);
  useEffect(() => setToText(String(rangeTo)), [rangeTo]);

  const handleCountChange = (raw: string) => {
    setCountText(raw);
    if (raw === '') return;
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    onNumbersToPickChange(clamp(parsed));
  };

  const handleCountBlur = () => {
    const parsed = parseInt(countText, 10);
    const next = clamp(Number.isNaN(parsed) ? 1 : parsed);
    onNumbersToPickChange(next);
    setCountText(String(next));
  };

  const handleRangeFromChange = (raw: string) => {
    setFromText(raw);
    if (raw === '') return;
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const next = clampRange(parsed);
    // "From" can't exceed "To"
    onRangeFromChange(Math.min(next, rangeTo));
  };

  const handleRangeFromBlur = () => {
    const parsed = parseInt(fromText, 10);
    const next = Math.min(clampRange(Number.isNaN(parsed) ? poolMin : parsed), rangeTo);
    onRangeFromChange(next);
    setFromText(String(next));
  };

  const handleRangeToChange = (raw: string) => {
    setToText(raw);
    if (raw === '') return;
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const next = clampRange(parsed);
    // "To" can't go below "From"
    onRangeToChange(Math.max(next, rangeFrom));
  };

  const handleRangeToBlur = () => {
    const parsed = parseInt(toText, 10);
    const next = Math.max(clampRange(Number.isNaN(parsed) ? poolMax : parsed), rangeFrom);
    onRangeToChange(next);
    setToText(String(next));
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
            value={countText}
            disabled={!canChangeCount}
            onChange={(e) => handleCountChange(e.target.value)}
            onBlur={handleCountBlur}
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

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="flex items-center gap-1.5 text-neutral-500 font-medium text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Range
          </label>
          <span className="text-[10px] text-neutral-400">
            {rangedCount} number{rangedCount === 1 ? '' : 's'} in range
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={poolMin}
            max={rangeTo}
            value={fromText}
            disabled={!canChangeCount}
            onChange={(e) => handleRangeFromChange(e.target.value)}
            onBlur={handleRangeFromBlur}
            className="w-16 bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-800 text-center disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="text-xs text-neutral-400 font-medium">to</span>
          <input
            type="number"
            min={rangeFrom}
            max={poolMax}
            value={toText}
            disabled={!canChangeCount}
            onChange={(e) => handleRangeToChange(e.target.value)}
            onBlur={handleRangeToBlur}
            className="w-16 bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-800 text-center disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="text-[10px] text-neutral-400 ml-auto">pool: {poolMin}–{poolMax}</span>
        </div>

        {rangedCount === 0 && (
          <p className="text-[11px] text-red-500 font-medium mt-1.5">
            No numbers fall in this range — widen it to draw.
          </p>
        )}
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
