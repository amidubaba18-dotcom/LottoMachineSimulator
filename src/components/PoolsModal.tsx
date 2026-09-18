/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertCircle,
  Check,
  ChevronLeft,
  Edit3,
  Layers,
  Link2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import {
  CustomPool,
  SharedPool,
} from '../types';

import {
  describePool,
  getPoolNumbers,
} from '../data/pools';

import { NumberGridPicker } from './NumberGridPicker';

interface PoolsModalProps {
  isOpen: boolean;
  onClose: () => void;

  savedPools: CustomPool[];
  sharedPools: SharedPool[];

  activePoolId: string;

  onSelectPool: (
    pool: CustomPool
  ) => void;

  onSaveNewPool: (
    pool: CustomPool
  ) => void;

  onUpdatePool: (
    pool: CustomPool
  ) => void;

  onDeletePool: (
    poolId: string
  ) => void;

  onSaveSharedPool: (
    pool: SharedPool
  ) => void;

  onUpdateSharedPool: (
    pool: SharedPool
  ) => void;

  onDeleteSharedPool: (
    poolId: string
  ) => void;
}

type MainTab =
  | 'pools'
  | 'shared';

type PoolView =
  | 'list'
  | 'editor';

type SharedView =
  | 'list'
  | 'editor';

export const PoolsModal: React.FC<
  PoolsModalProps
> = ({
  isOpen,
  onClose,
  savedPools,
  sharedPools,
  activePoolId,
  onSelectPool,
  onSaveNewPool,
  onUpdatePool,
  onDeletePool,
  onSaveSharedPool,
  onUpdateSharedPool,
  onDeleteSharedPool,
}) => {
    const [mainTab, setMainTab] =
      useState<MainTab>('pools');

    const [poolView, setPoolView] =
      useState<PoolView>('list');

    const [sharedView, setSharedView] =
      useState<SharedView>('list');

    const [editingPoolId, setEditingPoolId] =
      useState<string | null>(null);

    const [
      editingSharedPoolId,
      setEditingSharedPoolId,
    ] = useState<string | null>(null);

    const [name, setName] =
      useState('');

    const [numbers, setNumbers] =
      useState<number[]>([]);

    const [numbersToPick, setNumbersToPick] =
      useState(5);

    const [sharedPoolId, setSharedPoolId] =
      useState<string>('');

    const [gridOpen, setGridOpen] =
      useState(false);

    const [sharedGridOpen, setSharedGridOpen] =
      useState(false);

    const [error, setError] =
      useState<string | null>(null);

    useEffect(() => {
      if (!isOpen) return;

      setMainTab('pools');
      setPoolView('list');
      setSharedView('list');
      setEditingPoolId(null);
      setEditingSharedPoolId(null);
      setName('');
      setNumbers([]);
      setNumbersToPick(5);
      setSharedPoolId('');
      setError(null);
    }, [isOpen]);

    const editingPool = useMemo(
      () =>
        savedPools.find(
          (pool) =>
            pool.id === editingPoolId
        ),
      [savedPools, editingPoolId]
    );

    const editingSharedPool =
      useMemo(
        () =>
          sharedPools.find(
            (pool) =>
              pool.id ===
              editingSharedPoolId
          ),
        [
          sharedPools,
          editingSharedPoolId,
        ]
      );

    const effectiveNumbers = useMemo(() => {
      const tempPool: CustomPool = {
        id: 'preview',
        name: name || 'Preview',
        numbers,
        numbersToPick,
        sharedPoolId:
          sharedPoolId || undefined,
      };

      return getPoolNumbers(
        tempPool,
        sharedPools
      );
    }, [
      name,
      numbers,
      numbersToPick,
      sharedPoolId,
      sharedPools,
    ]);

    const startCreatingPool = () => {
      setPoolView('editor');
      setEditingPoolId(null);
      setName('');
      setNumbers([]);
      setNumbersToPick(5);
      setSharedPoolId('');
      setError(null);
    };

    const startEditingPool = (
      pool: CustomPool
    ) => {
      setPoolView('editor');
      setEditingPoolId(pool.id);
      setName(pool.name);
      setNumbers([...pool.numbers]);
      setNumbersToPick(pool.numbersToPick);
      setSharedPoolId(
        pool.sharedPoolId || ''
      );
      setError(null);
    };

    const savePool = () => {
      setError(null);

      if (!name.trim()) {
        setError(
          'Please enter a pool name.'
        );
        return;
      }

      if (numbers.length === 0 && !sharedPoolId) {
        setError(
          'Add at least one number or link a shared pool.'
        );
        return;
      }

      if (
        effectiveNumbers.length === 0
      ) {
        setError(
          'The pool must contain at least one number.'
        );
        return;
      }

      if (
        numbersToPick < 1 ||
        numbersToPick >
        effectiveNumbers.length
      ) {
        setError(
          `Balls to draw must be between 1 and ${effectiveNumbers.length}.`
        );
        return;
      }

      const pool: CustomPool = {
        id:
          editingPoolId ||
          `custom-${Date.now()}`,
        name: name.trim(),
        numbers: [...numbers],
        sharedPoolId:
          sharedPoolId || undefined,
        numbersToPick,
        description:
          describePool(
            {
              id:
                editingPoolId ||
                'preview',
              name: name.trim(),
              numbers,
              sharedPoolId:
                sharedPoolId ||
                undefined,
              numbersToPick,
            },
            sharedPools
          ),
        isPreset:
          editingPool?.isPreset ||
          false,
        createdAt:
          editingPool?.createdAt ||
          Date.now(),
      };

      if (editingPoolId) {
        onUpdatePool(pool);
      } else {
        onSaveNewPool(pool);
      }

      setPoolView('list');
      setEditingPoolId(null);
      setName('');
      setNumbers([]);
      setNumbersToPick(5);
      setSharedPoolId('');
    };

    const startCreatingSharedPool =
      () => {
        setSharedView('editor');
        setEditingSharedPoolId(null);
        setName('');
        setNumbers([]);
        setError(null);
      };

    const startEditingSharedPool = (
      pool: SharedPool
    ) => {
      setSharedView('editor');
      setEditingSharedPoolId(pool.id);
      setName(pool.name);
      setNumbers([...pool.numbers]);
      setError(null);
    };

    const saveSharedPool = () => {
      setError(null);

      if (!name.trim()) {
        setError(
          'Please enter a shared pool name.'
        );
        return;
      }

      if (numbers.length === 0) {
        setError(
          'Add at least one number to the shared pool.'
        );
        return;
      }

      const pool: SharedPool = {
        id:
          editingSharedPoolId ||
          `shared-${Date.now()}`,
        name: name.trim(),
        numbers: [...numbers],
        description:
          `${numbers.length} numbers`,
        createdAt:
          editingSharedPool?.createdAt ||
          Date.now(),
      };

      if (editingSharedPoolId) {
        onUpdateSharedPool(pool);
      } else {
        onSaveSharedPool(pool);
      }

      setSharedView('list');
      setEditingSharedPoolId(null);
      setName('');
      setNumbers([]);
    };

    if (!isOpen) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl border border-neutral-300 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          {/* Header */}

          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-neutral-800" />

              <div>
                <div className="font-black text-sm text-neutral-900">
                  Pools
                </div>

                <div className="text-[10px] text-neutral-400">
                  Manage your number pools
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main tabs */}

          <div className="flex border-b border-neutral-200 px-5">
            <button
              onClick={() => {
                setMainTab('pools');
                setPoolView('list');
              }}
              className={`
              px-1 mr-5 py-3 text-xs font-bold border-b-2
              ${mainTab === 'pools'
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-400'
                }
            `}
            >
              Custom Pools
            </button>

            <button
              onClick={() => {
                setMainTab('shared');
                setSharedView('list');
              }}
              className={`
              px-1 py-3 text-xs font-bold border-b-2
              ${mainTab === 'shared'
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-400'
                }
            `}
            >
              Shared Pools
            </button>
          </div>

          {/* Content */}

          <div className="flex-1 overflow-y-auto p-5">
            {mainTab === 'pools' && (
              <>
                {poolView === 'list' ? (
                  <div className="space-y-3">
                    <button
                      onClick={
                        startCreatingPool
                      }
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800"
                    >
                      <Plus className="w-4 h-4" />
                      New custom pool
                    </button>

                    {savedPools.map(
                      (pool) => {
                        const isActive =
                          pool.id ===
                          activePoolId;

                        const linkedShared =
                          pool.sharedPoolId
                            ? sharedPools.find(
                              (shared) =>
                                shared.id ===
                                pool.sharedPoolId
                            )
                            : undefined;

                        return (
                          <div
                            key={pool.id}
                            className={`
                            rounded-xl border p-3
                            ${isActive
                                ? 'border-neutral-900'
                                : 'border-neutral-200'
                              }
                          `}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-black text-neutral-900">
                                    {pool.name}
                                  </span>

                                  {isActive && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-900 text-white text-[9px] font-bold">
                                      <Check className="w-3 h-3" />
                                      Active
                                    </span>
                                  )}

                                  {linkedShared && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 text-[9px] font-bold">
                                      <Link2 className="w-3 h-3" />
                                      {linkedShared.name}
                                    </span>
                                  )}
                                </div>

                                <p className="text-[11px] text-neutral-400 mt-1">
                                  {describePool(
                                    pool,
                                    sharedPools
                                  )}
                                </p>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() =>
                                    startEditingPool(
                                      pool
                                    )
                                  }
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100"
                                  title="Edit pool"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>

                                {!pool.isPreset && (
                                  <button
                                    onClick={() =>
                                      onDeletePool(
                                        pool.id
                                      )
                                    }
                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50"
                                    title="Delete pool"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex justify-end mt-2">
                              {!isActive && (
                                <button
                                  onClick={() => {
                                    onSelectPool(
                                      pool
                                    );
                                    onClose();
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-[11px] font-bold"
                                >
                                  Load
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button
                      onClick={() =>
                        setPoolView('list')
                      }
                      className="flex items-center gap-1 text-xs font-bold text-neutral-500 hover:text-neutral-900"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back to pools
                    </button>

                    <div>
                      <h2 className="text-lg font-black text-neutral-900">
                        {editingPoolId
                          ? 'Edit custom pool'
                          : 'New custom pool'}
                      </h2>

                      <p className="text-xs text-neutral-400 mt-1">
                        Build your pool using the number picker.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                        Pool name
                      </label>

                      <input
                        value={name}
                        onChange={(event) =>
                          setName(
                            event.target.value
                          )
                        }
                        maxLength={40}
                        placeholder="e.g. Office Raffle"
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm outline-none focus:border-neutral-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                        Numbers
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          setGridOpen(true)
                        }
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-900 text-left"
                      >
                        <div>
                          <div className="text-xs font-bold text-neutral-900">
                            {numbers.length
                              ? `${numbers.length} own number${numbers.length ===
                                1
                                ? ''
                                : 's'
                              }`
                              : 'No own numbers yet'}
                          </div>

                          <div className="text-[10px] text-neutral-400 mt-0.5">
                            Click to open 1–90 picker
                          </div>
                        </div>

                        <Plus className="w-4 h-4 text-neutral-500" />
                      </button>
                    </div>

                    {/* Shared pool link */}

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-neutral-700">
                          Borrow from shared pool
                        </label>

                        <Link2 className="w-4 h-4 text-neutral-400" />
                      </div>

                      <select
                        value={sharedPoolId}
                        onChange={(event) => {
                          setSharedPoolId(
                            event.target.value
                          );

                          const selected =
                            sharedPools.find(
                              (pool) =>
                                pool.id ===
                                event.target.value
                            );

                          if (
                            selected &&
                            numbersToPick >
                            numbers.length +
                            selected.numbers
                              .length
                          ) {
                            setNumbersToPick(
                              Math.max(
                                1,
                                numbers.length +
                                selected
                                  .numbers
                                  .length
                              )
                            );
                          }
                        }}
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 bg-white text-sm outline-none focus:border-neutral-900"
                      >
                        <option value="">
                          No shared pool
                        </option>

                        {sharedPools.map(
                          (pool) => (
                            <option
                              key={pool.id}
                              value={pool.id}
                            >
                              {pool.name} —{' '}
                              {pool.numbers.length}{' '}
                              numbers
                            </option>
                          )
                        )}
                      </select>

                      {sharedPoolId && (
                        <p className="text-[10px] text-neutral-400 mt-1.5">
                          Numbers from this shared
                          pool are borrowed automatically.
                          Changes to the shared pool will
                          affect this pool.
                        </p>
                      )}
                    </div>

                    {/* Balls */}

                    <div className="flex items-center justify-between rounded-xl border border-neutral-200 p-3">
                      <div>
                        <div className="text-xs font-bold text-neutral-800">
                          Balls to draw
                        </div>

                        <div className="text-[10px] text-neutral-400 mt-0.5">
                          Available: {effectiveNumbers.length}
                        </div>
                      </div>

                      <input
                        type="number"
                        min={1}
                        max={Math.max(
                          1,
                          effectiveNumbers.length
                        )}
                        value={numbersToPick}
                        onChange={(event) =>
                          setNumbersToPick(
                            Math.max(
                              1,
                              Math.min(
                                effectiveNumbers.length ||
                                1,
                                Number(
                                  event.target.value
                                ) || 1
                              )
                            )
                          )
                        }
                        className="w-20 px-2 py-1.5 text-center rounded-lg border border-neutral-300 text-sm font-black"
                      />
                    </div>

                    {/* Preview */}

                    <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          Pool preview
                        </span>

                        <span className="text-[10px] font-bold text-neutral-500">
                          {effectiveNumbers.length}{' '}
                          total
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {effectiveNumbers
                          .slice(0, 80)
                          .map(
                            (number, index) => (
                              <span
                                key={`${number}-${index}`}
                                className="w-7 h-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[10px] font-bold text-neutral-800"
                              >
                                {number}
                              </span>
                            )
                          )}

                        {effectiveNumbers.length >
                          80 && (
                            <span className="px-2 text-[10px] font-bold text-neutral-400 flex items-center">
                              +
                              {effectiveNumbers.length -
                                80}{' '}
                              more
                            </span>
                          )}
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-neutral-100 border border-neutral-300 text-xs font-medium text-neutral-800">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-neutral-100">
                      <button
                        onClick={() =>
                          setPoolView('list')
                        }
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={savePool}
                        className="flex-[1.5] py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold"
                      >
                        {editingPoolId
                          ? 'Save changes'
                          : 'Create pool'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* SHARED POOLS */}

            {mainTab === 'shared' && (
              <>
                {sharedView === 'list' ? (
                  <div className="space-y-3">
                    <button
                      onClick={
                        startCreatingSharedPool
                      }
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-900 text-white text-xs font-bold"
                    >
                      <Plus className="w-4 h-4" />
                      New shared pool
                    </button>

                    {sharedPools.length ===
                      0 && (
                        <div className="text-center py-10">
                          <Layers className="w-8 h-8 mx-auto text-neutral-300 mb-2" />

                          <p className="text-sm font-bold text-neutral-700">
                            No shared pools
                          </p>

                          <p className="text-xs text-neutral-400 mt-1">
                            Create one to let multiple
                            custom pools borrow the same
                            numbers.
                          </p>
                        </div>
                      )}

                    {sharedPools.map(
                      (pool) => {
                        const linkedCount =
                          savedPools.filter(
                            (custom) =>
                              custom.sharedPoolId ===
                              pool.id
                          ).length;

                        return (
                          <div
                            key={pool.id}
                            className="rounded-xl border border-neutral-200 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-black text-neutral-900">
                                  {pool.name}
                                </div>

                                <div className="text-[10px] text-neutral-400 mt-1">
                                  {pool.numbers.length}{' '}
                                  numbers
                                  {linkedCount > 0 &&
                                    ` • ${linkedCount} custom pool${linkedCount ===
                                      1
                                      ? ''
                                      : 's'
                                    } linked`}
                                </div>
                              </div>

                              <div className="flex gap-1">
                                <button
                                  onClick={() =>
                                    startEditingSharedPool(
                                      pool
                                    )
                                  }
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() =>
                                    onDeleteSharedPool(
                                      pool.id
                                    )
                                  }
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 mt-3 max-h-20 overflow-hidden">
                              {pool.numbers
                                .slice(0, 25)
                                .map(
                                  (
                                    number,
                                    index
                                  ) => (
                                    <span
                                      key={`${pool.id}-${number}-${index}`}
                                      className="w-7 h-7 rounded-full border border-neutral-200 bg-neutral-50 flex items-center justify-center text-[10px] font-bold"
                                    >
                                      {number}
                                    </span>
                                  )
                                )}

                              {pool.numbers.length >
                                25 && (
                                  <span className="text-[10px] font-bold text-neutral-400 flex items-center px-1">
                                    +
                                    {pool.numbers.length -
                                      25}
                                  </span>
                                )}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button
                      onClick={() =>
                        setSharedView('list')
                      }
                      className="flex items-center gap-1 text-xs font-bold text-neutral-500 hover:text-neutral-900"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back to shared pools
                    </button>

                    <div>
                      <h2 className="text-lg font-black text-neutral-900">
                        {editingSharedPoolId
                          ? 'Edit shared pool'
                          : 'New shared pool'}
                      </h2>

                      <p className="text-xs text-neutral-400 mt-1">
                        Any custom pool linked to this
                        pool will receive its numbers.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                        Shared pool name
                      </label>

                      <input
                        value={name}
                        onChange={(event) =>
                          setName(
                            event.target.value
                          )
                        }
                        maxLength={40}
                        placeholder="e.g. Weekend Numbers"
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm outline-none focus:border-neutral-900"
                      />
                    </div>

                    <button
                      onClick={() =>
                        setSharedGridOpen(true)
                      }
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-900"
                    >
                      <div className="text-left">
                        <div className="text-xs font-bold">
                          {numbers.length
                            ? `${numbers.length} numbers selected`
                            : 'Pick numbers'}
                        </div>

                        <div className="text-[10px] text-neutral-400 mt-0.5">
                          Open 1–90 number picker
                        </div>
                      </div>

                      <Plus className="w-4 h-4 text-neutral-500" />
                    </button>

                    {numbers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                        {numbers.map(
                          (
                            number,
                            index
                          ) => (
                            <span
                              key={`${number}-${index}`}
                              className="w-7 h-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[10px] font-bold"
                            >
                              {number}
                            </span>
                          )
                        )}
                      </div>
                    )}

                    {error && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-neutral-100 border border-neutral-300 text-xs font-medium">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-neutral-100">
                      <button
                        onClick={() =>
                          setSharedView('list')
                        }
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-neutral-600"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={
                          saveSharedPool
                        }
                        className="flex-[1.5] py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold"
                      >
                        {editingSharedPoolId
                          ? 'Save changes'
                          : 'Create shared pool'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <NumberGridPicker
          isOpen={gridOpen}
          numbers={numbers}
          onChange={setNumbers}
          onClose={() =>
            setGridOpen(false)
          }
        />

        <NumberGridPicker
          isOpen={sharedGridOpen}
          numbers={numbers}
          onChange={setNumbers}
          onClose={() =>
            setSharedGridOpen(false)
          }
        />
      </div>
    );
  };