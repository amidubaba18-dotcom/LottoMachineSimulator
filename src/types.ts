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
  // The full pool (customNumbers) always spawns and tumbles in the globe.
  // drawMin/drawMax restrict which balls are ELIGIBLE to be selected as a
  // winner — everything outside this window still tumbles but can never be
  // pulled. Defaults to min/max (whole pool drawable) when omitted.
  drawMin?: number;
  drawMax?: number;
}

export interface LotteryMachineHandle {
  draw: () => void;
  reset: () => void;
}

export interface CustomPool {
  id: string;
  name: string;

  /**
   * Numbers manually belonging to this pool.
   */
  numbers: number[];

  /**
   * Optional shared pool whose numbers are added
   * to this custom pool.
   */
  sharedPoolId?: string;

  /**
   * Numbers that should always be added to the
   * drawing pool, even if they are not in the
   * custom/shared pool.
   */
  includeNumbers?: number[];

  /**
   * Numbers that must never be drawn.
   *
   * Exclude wins over Include when a number
   * exists in both lists.
   */
  excludeNumbers?: number[];

  /**
   * Kept for backwards compatibility with
   * older saved pools.
   *
   * New code does NOT use this as the active
   * drawing count.
   */
  numbersToPick?: number;

  description?: string;
  isPreset?: boolean;
  createdAt?: number;
}

export interface SharedPool {
  id: string;
  name: string;
  numbers: number[];
  description?: string;
  createdAt?: number;
}

export interface DrawHistoryRecord {
  id: string;
  timestamp: number;
  numbers: number[];
  min: number;
  max: number;
  numbersToPick: number;
  machineType: 'mechanical' | 'blower';
  poolName: string;
}