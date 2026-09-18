/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CustomPool } from '../types';

export const STORAGE_KEY_POOLS = 'lottery_custom_pools_v1';

export const DEFAULT_PRESET_POOLS: CustomPool[] = [
  {
    id: 'preset-classic-49',
    name: 'Standard 6/49',
    type: 'range',
    min: 1,
    max: 49,
    numbersToPick: 6,
    description: '1 to 49 • Classic national lottery draw',
    isPreset: true,
  },
  {
    id: 'preset-powerball-69',
    name: 'Powerball Main',
    type: 'range',
    min: 1,
    max: 69,
    numbersToPick: 5,
    description: '1 to 69 • 5 white lottery balls',
    isPreset: true,
  },
  {
    id: 'preset-euromillions-50',
    name: 'EuroMillions',
    type: 'range',
    min: 1,
    max: 50,
    numbersToPick: 5,
    description: '1 to 50 • European jackpot pool',
    isPreset: true,
  },
  {
    id: 'preset-ninety',
    name: 'Bingo 1–90',
    type: 'range',
    min: 1,
    max: 90,
    numbersToPick: 5,
    description: '1 to 90 • Bingo / Keno-style pool',
    isPreset: true,
  },
  {
    id: 'preset-mini-20',
    name: 'Quick Mini (1–20)',
    type: 'range',
    min: 1,
    max: 20,
    numbersToPick: 4,
    description: '1 to 20 • Fast testing & rapid games',
    isPreset: true,
  },
];

export function loadSavedPools(): CustomPool[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_POOLS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const userCustoms = parsed.filter((p: CustomPool) => !p.isPreset);
        return [...DEFAULT_PRESET_POOLS, ...userCustoms];
      }
    }
  } catch (err) {
    console.warn('Failed to load custom pools:', err);
  }
  return [...DEFAULT_PRESET_POOLS];
}

export function persistCustomPools(pools: CustomPool[]): void {
  try {
    const userPools = pools.filter((p) => !p.isPreset);
    localStorage.setItem(STORAGE_KEY_POOLS, JSON.stringify(userPools));
  } catch (err) {
    console.warn('Failed to persist custom pools:', err);
  }
}

export function parseCustomNumbers(rawInput: string): number[] {
  if (!rawInput.trim()) return [];
  const tokens = rawInput.split(/[\s,;|\n\r]+/);
  const validNumbers: number[] = [];
  for (const token of tokens) {
    const clean = token.trim();
    if (!clean) continue;
    const num = Number(clean);
    if (!isNaN(num) && Number.isInteger(num) && num > 0 && num <= 999) {
      validNumbers.push(num);
    }
  }
  return Array.from(new Set(validNumbers));
}