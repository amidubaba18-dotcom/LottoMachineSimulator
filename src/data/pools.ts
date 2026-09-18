/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CustomPool, SharedPool } from '../types';

export const STORAGE_KEY_POOLS = 'lottery_custom_pools_v2';
export const STORAGE_KEY_SHARED_POOLS = 'lottery_shared_pools_v1';

/**
 * Built-in pools are now explicit number lists.
 * There is no range type involved in the new system.
 */
export const DEFAULT_PRESET_POOLS: CustomPool[] = [
  {
    id: 'preset-classic-49',
    name: 'Standard 6/49',
    numbers: Array.from({ length: 49 }, (_, i) => i + 1),
    numbersToPick: 6,
    description: '49 numbers • Pick 6',
    isPreset: true,
  },

  {
    id: 'preset-powerball-69',
    name: 'Powerball Main',
    numbers: Array.from({ length: 69 }, (_, i) => i + 1),
    numbersToPick: 5,
    description: '69 numbers • Pick 5',
    isPreset: true,
  },

  {
    id: 'preset-euromillions-50',
    name: 'EuroMillions',
    numbers: Array.from({ length: 50 }, (_, i) => i + 1),
    numbersToPick: 5,
    description: '50 numbers • Pick 5',
    isPreset: true,
  },

  {
    id: 'preset-ninety',
    name: 'Bingo 1–90',
    numbers: Array.from({ length: 90 }, (_, i) => i + 1),
    numbersToPick: 5,
    description: '90 numbers • Pick 5',
    isPreset: true,
  },

  {
    id: 'preset-mini-20',
    name: 'Quick Mini',
    numbers: Array.from({ length: 20 }, (_, i) => i + 1),
    numbersToPick: 4,
    description: '20 numbers • Pick 4',
    isPreset: true,
  },
];

export function normalizeNumbers(numbers: number[]): number[] {
  return numbers.filter(
    (n) =>
      Number.isInteger(n) &&
      n >= 1 &&
      n <= 90
  );
}

/**
 * Converts old saved pool structures into the new structure.
 * This prevents existing users from losing their pools.
 */
function migratePool(pool: any): CustomPool | null {
  if (!pool || typeof pool !== 'object') return null;

  let numbers: number[] = [];

  if (Array.isArray(pool.numbers)) {
    numbers = normalizeNumbers(pool.numbers);
  } else if (Array.isArray(pool.customNumbers)) {
    numbers = normalizeNumbers(pool.customNumbers);
  } else if (
    Number.isInteger(pool.min) &&
    Number.isInteger(pool.max)
  ) {
    const min = Math.max(1, pool.min);
    const max = Math.min(90, pool.max);

    for (let i = min; i <= max; i++) {
      numbers.push(i);
    }
  }

  if (numbers.length === 0) return null;

  const numbersToPick = Math.max(
    1,
    Math.min(
      Number(pool.numbersToPick) || 1,
      numbers.length
    )
  );

  return {
    id: String(pool.id || `custom-${Date.now()}`),
    name: String(
      pool.name ||
      `Custom (${numbers.length})`
    ),
    numbers,
    sharedPoolId:
      typeof pool.sharedPoolId === 'string'
        ? pool.sharedPoolId
        : undefined,
    numbersToPick,
    description:
      `${numbers.length} numbers • Pick ${numbersToPick}`,
    isPreset: Boolean(pool.isPreset),
    createdAt: pool.createdAt || Date.now(),
  };
}

export function loadSavedPools(): CustomPool[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_POOLS);

    if (raw) {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        const customs = parsed
          .map(migratePool)
          .filter(
            (pool): pool is CustomPool =>
              Boolean(pool) && !pool.isPreset
          );

        return [
          ...DEFAULT_PRESET_POOLS,
          ...customs,
        ];
      }
    }
  } catch (err) {
    console.warn(
      'Failed to load custom pools:',
      err
    );
  }

  return [...DEFAULT_PRESET_POOLS];
}

export function persistCustomPools(
  pools: CustomPool[]
): void {
  try {
    const userPools = pools
      .filter((pool) => !pool.isPreset)
      .map((pool) => ({
        ...pool,
        type: undefined,
        min: undefined,
        max: undefined,
        customNumbers: undefined,
      }));

    localStorage.setItem(
      STORAGE_KEY_POOLS,
      JSON.stringify(userPools)
    );
  } catch (err) {
    console.warn(
      'Failed to persist custom pools:',
      err
    );
  }
}

/* ------------------------------------------------------------------ */
/* Shared pools                                                        */
/* ------------------------------------------------------------------ */

export function loadSharedPools(): SharedPool[] {
  try {
    const raw = localStorage.getItem(
      STORAGE_KEY_SHARED_POOLS
    );

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (pool) =>
          pool &&
          typeof pool.id === 'string' &&
          typeof pool.name === 'string' &&
          Array.isArray(pool.numbers)
      )
      .map((pool) => ({
        id: pool.id,
        name: pool.name,
        numbers: normalizeNumbers(pool.numbers),
        description:
          pool.description ||
          `${pool.numbers.length} numbers`,
        createdAt:
          pool.createdAt || Date.now(),
      }));
  } catch (err) {
    console.warn(
      'Failed to load shared pools:',
      err
    );

    return [];
  }
}

export function persistSharedPools(
  pools: SharedPool[]
): void {
  try {
    localStorage.setItem(
      STORAGE_KEY_SHARED_POOLS,
      JSON.stringify(pools)
    );
  } catch (err) {
    console.warn(
      'Failed to persist shared pools:',
      err
    );
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function getPoolNumbers(
  pool: CustomPool,
  sharedPools: SharedPool[]
): number[] {
  const ownNumbers = Array.isArray(pool.numbers)
    ? pool.numbers
    : [];

  if (!pool.sharedPoolId) {
    return [...ownNumbers];
  }

  const sharedPool = sharedPools.find(
    (shared) =>
      shared.id === pool.sharedPoolId
  );

  if (!sharedPool) {
    return [...ownNumbers];
  }

  /**
   * Shared numbers are borrowed into the custom pool.
   *
   * Duplicates are intentionally allowed because the
   * React Native implementation supports them.
   */
  return [
    ...ownNumbers,
    ...sharedPool.numbers,
  ];
}

export function describePool(
  pool: CustomPool,
  sharedPools: SharedPool[]
): string {
  const ownCount = pool.numbers.length;

  const sharedPool = pool.sharedPoolId
    ? sharedPools.find(
      (shared) =>
        shared.id === pool.sharedPoolId
    )
    : undefined;

  if (sharedPool) {
    return `${ownCount} own + ${sharedPool.numbers.length} borrowed • Pick ${pool.numbersToPick}`;
  }

  return `${ownCount} numbers • Pick ${pool.numbersToPick}`;
}

/**
 * Kept for compatibility with old imports.
 */
export function parseCustomNumbers(
  rawInput: string
): number[] {
  if (!rawInput.trim()) return [];

  const tokens = rawInput.split(
    /[\s,;|\n\r]+/
  );

  const validNumbers: number[] = [];

  for (const token of tokens) {
    const clean = token.trim();

    if (!clean) continue;

    const num = Number(clean);

    if (
      !Number.isNaN(num) &&
      Number.isInteger(num) &&
      num > 0 &&
      num <= 90
    ) {
      validNumbers.push(num);
    }
  }

  return validNumbers;
}