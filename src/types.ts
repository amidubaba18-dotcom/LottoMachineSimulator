/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Phase = 'idle' | 'falling' | 'spinning' | 'drawing';

export interface LotteryMachineProps {
  min: number;
  max: number;
  customNumbers?: number[];
  numbersToPick: number;
  drawnNumbers: number[];
  onBallDrawn: (value: number) => void;
  speedMultiplier?: number;
  soundEnabled?: boolean;
  machineType?: 'mechanical' | 'blower';
  debugMode?: boolean;
  onDrawAll: () => void;
  onReset: () => void;
  isDrawing: boolean;
  isComplete: boolean;
}

export interface LotteryMachineHandle {
  draw: () => void;
  reset: () => void;
}

/**
 * A reusable pool of numbers.
 *
 * Shared pools are independent from custom pools and can be
 * linked to multiple custom pools.
 */
export interface SharedPool {
  id: string;
  name: string;
  numbers: number[];
  description?: string;
  createdAt?: number;
}

/**
 * A user-created lottery pool.
 *
 * `numbers` is now the source of truth.
 *
 * `sharedPoolId` is optional. When present, the numbers from
 * that shared pool are borrowed and added to this pool.
 */
export interface CustomPool {
  id: string;
  name: string;

  /**
   * The numbers owned directly by this custom pool.
   */
  numbers: number[];

  /**
   * Optional shared pool whose numbers are borrowed.
   */
  sharedPoolId?: string;

  /**
   * Kept for compatibility with older saved data/components.
   */
  type?: 'custom_list' | 'range';
  min?: number;
  max?: number;
  customNumbers?: number[];

  numbersToPick: number;
  description?: string;
  isPreset?: boolean;
  createdAt?: number;
}

export interface DrawHistoryRecord {
  id: string;
  timestamp: number;
  numbers: number[];
  min: number;
  max: number;
  numbersToPick: number;
  machineType?: 'mechanical' | 'blower';
  poolName?: string;
}