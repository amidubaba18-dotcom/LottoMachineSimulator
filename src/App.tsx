/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Dices,
  Layers,
} from 'lucide-react';

import { LotteryMachine } from './components/LotteryMachine';
import { Controls } from './components/Controls';
import { ResultsModal } from './components/ResultsModal';
import { HistoryLog } from './components/HistoryLog';
import { PoolsModal } from './components/PoolsModal';
import { InstallPromptButton } from './components/InstallPromptButton';

import {
  CustomPool,
  DrawHistoryRecord,
  LotteryMachineHandle,
  SharedPool,
} from './types';

import {
  DEFAULT_PRESET_POOLS,
  describePool,
  getPoolNumbers,
  loadSavedPools,
  loadSharedPools,
  persistCustomPools,
  persistSharedPools,
} from './data/pools';

const STORAGE_KEY =
  'lottery_machine_draw_history';

const AUTO_RESET_DELAY_MS = 900;

export default function App() {
  const machineRef =
    useRef<LotteryMachineHandle | null>(
      null
    );

  const autoResetTimeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const [
    savedPools,
    setSavedPools,
  ] = useState<CustomPool[]>(
    () => loadSavedPools()
  );

  const [
    sharedPools,
    setSharedPools,
  ] = useState<SharedPool[]>(
    () => loadSharedPools()
  );

  const [
    activePool,
    setActivePool,
  ] = useState<CustomPool>(() => {
    const pools = loadSavedPools();

    return (
      pools[0] ||
      DEFAULT_PRESET_POOLS[0]
    );
  });

  const [
    isPoolsModalOpen,
    setIsPoolsModalOpen,
  ] = useState(false);

  const [
    drawnNumbers,
    setDrawnNumbers,
  ] = useState<number[]>([]);

  const [
    isDrawing,
    setIsDrawing,
  ] = useState(false);

  const [
    speedMultiplier,
    setSpeedMultiplier,
  ] = useState(1);

  const [
    soundEnabled,
    setSoundEnabled,
  ] = useState(true);

  const [
    machineType,
    setMachineType,
  ] = useState<
    'mechanical' | 'blower'
  >('mechanical');

  const [
    resultsOpen,
    setResultsOpen,
  ] = useState(false);

  const [
    lastDraw,
    setLastDraw,
  ] = useState<number[]>([]);

  const [
    history,
    setHistory,
  ] = useState<DrawHistoryRecord[]>(
    () => {
      try {
        const stored =
          localStorage.getItem(
            STORAGE_KEY
          );

        if (stored) {
          const parsed =
            JSON.parse(stored);

          if (Array.isArray(parsed)) {
            return parsed;
          }
        }
      } catch (error) {
        console.warn(
          'Failed to parse history:',
          error
        );
      }

      return [];
    }
  );

  const lastRecordedDrawRef =
    useRef('');

  /**
   * Numbers actually available to the machine.
   *
   * This is:
   *
   * custom pool numbers
   * +
   * borrowed shared pool numbers
   */
  const effectivePoolNumbers =
    useMemo(() => {
      return getPoolNumbers(
        activePool,
        sharedPools
      );
    }, [
      activePool,
      sharedPools,
    ]);

  /**
   * Machine props still expect min/max.
   * They are now derived from the actual
   * number list.
   */
  const min = useMemo(() => {
    if (
      effectivePoolNumbers.length === 0
    ) {
      return 1;
    }

    return Math.min(
      ...effectivePoolNumbers
    );
  }, [effectivePoolNumbers]);

  const max = useMemo(() => {
    if (
      effectivePoolNumbers.length === 0
    ) {
      return 90;
    }

    return Math.max(
      ...effectivePoolNumbers
    );
  }, [effectivePoolNumbers]);

  const numbersToPick =
    activePool.numbersToPick;

  const clearAutoResetTimeout =
    useCallback(() => {
      if (
        autoResetTimeoutRef.current !==
        null
      ) {
        clearTimeout(
          autoResetTimeoutRef.current
        );

        autoResetTimeoutRef.current =
          null;
      }
    }, []);

  /* --------------------------------------------------------------- */
  /* Pool selection                                                   */
  /* --------------------------------------------------------------- */

  const handleSelectPool =
    useCallback(
      (pool: CustomPool) => {
        clearAutoResetTimeout();

        setActivePool(pool);

        setDrawnNumbers([]);

        setIsDrawing(false);

        setResultsOpen(false);

        machineRef.current?.reset();
      },
      [clearAutoResetTimeout]
    );

  /* --------------------------------------------------------------- */
  /* Custom pools                                                     */
  /* --------------------------------------------------------------- */

  const handleSaveNewPool =
    useCallback(
      (newPool: CustomPool) => {
        setSavedPools((previous) => {
          const updated = [
            newPool,
            ...previous.filter(
              (pool) =>
                pool.id !== newPool.id
            ),
          ];

          persistCustomPools(
            updated
          );

          return updated;
        });

        handleSelectPool(newPool);
      },
      [handleSelectPool]
    );

  const handleUpdatePool =
    useCallback(
      (updatedPool: CustomPool) => {
        setSavedPools((previous) => {
          const updated =
            previous.map((pool) =>
              pool.id === updatedPool.id
                ? updatedPool
                : pool
            );

          persistCustomPools(
            updated
          );

          return updated;
        });

        /**
         * If the edited pool is currently
         * active, update the active state too.
         */
        if (
          activePool.id ===
          updatedPool.id
        ) {
          setActivePool(
            updatedPool
          );

          setDrawnNumbers([]);
          setIsDrawing(false);
          setResultsOpen(false);

          machineRef.current?.reset();
        }
      },
      [activePool.id]
    );

  const handleDeletePool =
    useCallback(
      (poolId: string) => {
        setSavedPools((previous) => {
          const updated =
            previous.filter(
              (pool) =>
                pool.id !== poolId
            );

          persistCustomPools(
            updated
          );

          return updated;
        });

        if (
          activePool.id === poolId
        ) {
          const fallback =
            DEFAULT_PRESET_POOLS[0];

          setActivePool(fallback);

          setDrawnNumbers([]);
          setIsDrawing(false);
          setResultsOpen(false);

          machineRef.current?.reset();
        }
      },
      [activePool.id]
    );

  /* --------------------------------------------------------------- */
  /* Shared pools                                                     */
  /* --------------------------------------------------------------- */

  const handleSaveSharedPool =
    useCallback(
      (pool: SharedPool) => {
        setSharedPools((previous) => {
          const updated = [
            pool,
            ...previous.filter(
              (item) =>
                item.id !== pool.id
            ),
          ];

          persistSharedPools(
            updated
          );

          return updated;
        });
      },
      []
    );

  const handleUpdateSharedPool =
    useCallback(
      (pool: SharedPool) => {
        setSharedPools((previous) => {
          const updated =
            previous.map((item) =>
              item.id === pool.id
                ? pool
                : item
            );

          persistSharedPools(
            updated
          );

          return updated;
        });

        /**
         * Shared pools are live.
         *
         * If the active custom pool is linked
         * to this shared pool, reset the current
         * draw because its available numbers
         * changed.
         */
        if (
          activePool.sharedPoolId ===
          pool.id
        ) {
          setDrawnNumbers([]);
          setIsDrawing(false);
          setResultsOpen(false);

          machineRef.current?.reset();
        }
      },
      [
        activePool.sharedPoolId,
      ]
    );

  const handleDeleteSharedPool =
    useCallback(
      (poolId: string) => {
        setSharedPools((previous) => {
          const updated =
            previous.filter(
              (pool) =>
                pool.id !== poolId
            );

          persistSharedPools(
            updated
          );

          return updated;
        });

        /**
         * Unlink custom pools that were
         * borrowing from this shared pool.
         */
        setSavedPools((previous) => {
          const updated =
            previous.map((pool) => {
              if (
                pool.sharedPoolId !==
                poolId
              ) {
                return pool;
              }

              return {
                ...pool,
                sharedPoolId:
                  undefined,
                description:
                  describePool(
                    {
                      ...pool,
                      sharedPoolId:
                        undefined,
                    },
                    []
                  ),
              };
            });

          persistCustomPools(
            updated
          );

          return updated;
        });

        if (
          activePool.sharedPoolId ===
          poolId
        ) {
          setActivePool((previous) => ({
            ...previous,
            sharedPoolId:
              undefined,
            description:
              describePool(
                {
                  ...previous,
                  sharedPoolId:
                    undefined,
                },
                []
              ),
          }));

          setDrawnNumbers([]);
          setIsDrawing(false);
          setResultsOpen(false);

          machineRef.current?.reset();
        }
      },
      [activePool.sharedPoolId]
    );

  /* --------------------------------------------------------------- */
  /* History                                                          */
  /* --------------------------------------------------------------- */

  const saveDrawToHistory =
    useCallback(
      (numbers: number[]) => {
        if (
          numbers.length === 0
        ) {
          return;
        }

        const signature =
          `${numbers.join(',')}-${activePool.id}-${machineType}`;

        if (
          lastRecordedDrawRef.current ===
          signature
        ) {
          return;
        }

        lastRecordedDrawRef.current =
          signature;

        const newRecord: DrawHistoryRecord =
        {
          id: `draw-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 7)}`,

          timestamp: Date.now(),

          numbers: [...numbers],

          min,

          max,

          numbersToPick,

          machineType,

          poolName:
            activePool.name,
        };

        setHistory((previous) => {
          const updated = [
            newRecord,
            ...previous,
          ].slice(0, 100);

          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(updated)
            );
          } catch (error) {
            console.warn(error);
          }

          return updated;
        });
      },
      [
        activePool.id,
        activePool.name,
        machineType,
        min,
        max,
        numbersToPick,
      ]
    );

  const handleClearHistory =
    useCallback(() => {
      setHistory([]);

      try {
        localStorage.removeItem(
          STORAGE_KEY
        );
      } catch (error) {
        console.warn(error);
      }
    }, []);

  const handleDeleteRecord =
    useCallback((id: string) => {
      setHistory((previous) => {
        const updated =
          previous.filter(
            (item) =>
              item.id !== id
          );

        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(updated)
          );
        } catch (error) {
          console.warn(error);
        }

        return updated;
      });
    }, []);

  /* --------------------------------------------------------------- */
  /* Drawing                                                          */
  /* --------------------------------------------------------------- */

  const handleBallDrawn =
    useCallback(
      (ballValue: number) => {
        setDrawnNumbers(
          (previous) => {
            if (
              previous.includes(
                ballValue
              )
            ) {
              return previous;
            }

            const next = [
              ...previous,
              ballValue,
            ];

            if (
              next.length >=
              numbersToPick
            ) {
              setIsDrawing(false);

              saveDrawToHistory(
                next
              );

              setLastDraw(next);

              setResultsOpen(true);

              clearAutoResetTimeout();

              autoResetTimeoutRef.current =
                setTimeout(() => {
                  setDrawnNumbers(
                    []
                  );

                  machineRef.current?.reset();

                  autoResetTimeoutRef.current =
                    null;
                }, AUTO_RESET_DELAY_MS);
            }

            return next;
          }
        );
      },
      [
        numbersToPick,
        saveDrawToHistory,
        clearAutoResetTimeout,
      ]
    );

  const handleDrawAll =
    useCallback(() => {
      if (
        machineRef.current
      ) {
        setIsDrawing(true);

        machineRef.current.draw();
      }
    }, []);

  const handleReset =
    useCallback(() => {
      clearAutoResetTimeout();

      setIsDrawing(false);

      setDrawnNumbers([]);

      setResultsOpen(false);

      machineRef.current?.reset();
    }, [
      clearAutoResetTimeout,
    ]);

  const isComplete =
    drawnNumbers.length >=
    numbersToPick;

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
            onClick={() =>
              setIsPoolsModalOpen(
                true
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold"
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
              customNumbers={
                effectivePoolNumbers
              }
              numbersToPick={
                numbersToPick
              }
              drawnNumbers={
                drawnNumbers
              }
              onBallDrawn={
                handleBallDrawn
              }
              speedMultiplier={
                speedMultiplier
              }
              soundEnabled={
                soundEnabled
              }
              machineType={
                machineType
              }
              onDrawAll={
                handleDrawAll
              }
              onReset={
                handleReset
              }
              isDrawing={
                isDrawing
              }
              isComplete={
                isComplete
              }
            />
          </div>

          <div className="flex flex-col gap-4 w-full max-w-md">
            <Controls
              isDrawing={isDrawing}
              drawnCount={
                drawnNumbers.length
              }
              numbersToPick={
                numbersToPick
              }
              maxNumbersToPick={Math.min(
                30,
                effectivePoolNumbers.length
              )}
              onNumbersToPickChange={(
                value
              ) => {
                setActivePool(
                  (previous) => ({
                    ...previous,
                    numbersToPick:
                      value,
                  })
                );
              }}
              activePool={activePool}
              speedMultiplier={
                speedMultiplier
              }
              onSpeedChange={
                setSpeedMultiplier
              }
              soundEnabled={
                soundEnabled
              }
              onToggleSound={() =>
                setSoundEnabled(
                  (previous) =>
                    !previous
                )
              }
              machineType={
                machineType
              }
              onMachineTypeChange={
                setMachineType
              }
            />
          </div>
        </div>

        <HistoryLog
          history={history}
          onClearHistory={
            handleClearHistory
          }
          onDeleteRecord={
            handleDeleteRecord
          }
        />
      </main>

      <ResultsModal
        isOpen={resultsOpen}
        onClose={() =>
          setResultsOpen(false)
        }
        numbers={lastDraw}
        target={numbersToPick}
        min={min}
        max={max}
        poolName={
          activePool.name
        }
        machineType={
          machineType
        }
      />

      <PoolsModal
        isOpen={
          isPoolsModalOpen
        }
        onClose={() =>
          setIsPoolsModalOpen(false)
        }
        savedPools={
          savedPools
        }
        sharedPools={
          sharedPools
        }
        activePoolId={
          activePool.id
        }
        onSelectPool={
          handleSelectPool
        }
        onSaveNewPool={
          handleSaveNewPool
        }
        onUpdatePool={
          handleUpdatePool
        }
        onDeletePool={
          handleDeletePool
        }
        onSaveSharedPool={
          handleSaveSharedPool
        }
        onUpdateSharedPool={
          handleUpdateSharedPool
        }
        onDeleteSharedPool={
          handleDeleteSharedPool
        }
      />
    </div>
  );
}