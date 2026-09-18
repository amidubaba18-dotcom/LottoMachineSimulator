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
}

export interface LotteryMachineHandle {
  draw: () => void;
  reset: () => void;
}

export interface CustomPool {
  id: string;
  name: string;
  type: 'range' | 'custom_list';
  min: number;
  max: number;
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