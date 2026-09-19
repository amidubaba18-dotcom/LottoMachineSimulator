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
    const [
      mainTab,
      setMainTab,
    ] = useState<MainTab>('pools');

    const [
      poolView,
      setPoolView,
    ] = useState<PoolView>('list');

    const [
      sharedView,
      setSharedView,
    ] = useState<SharedView>('list');

    const [
      editingPoolId,
      setEditingPoolId,
    ] = useState<string | null>(null);

    const [
      editingSharedPoolId,
      setEditingSharedPoolId,
    ] = useState<string | null>(null);

    const [
      name,
      setName,
    ] = useState('');

    const [
      numbers,
      setNumbers,
    ] = useState<number[]>([]);

    const [
      includeNumbers,
      setIncludeNumbers,
    ] = useState<number[]>([]);

    const [
      excludeNumbers,
      setExcludeNumbers,
    ] = useState<number[]>([]);

    const [
      sharedPoolId,
      setSharedPoolId,
    ] = useState('');

    const [
      gridOpen,
      setGridOpen,
    ] = useState(false);

    const [
      includeGridOpen,
      setIncludeGridOpen,
    ] = useState(false);

    const [
      excludeGridOpen,
      setExcludeGridOpen,
    ] = useState(false);

    const [
      sharedGridOpen,
      setSharedGridOpen,
    ] = useState(false);

    const [
      error,
      setError,
    ] = useState<string | null>(null);

    useEffect(() => {
      if (!isOpen) {
        return;
      }

      setMainTab('pools');
      setPoolView('list');
      setSharedView('list');

      setEditingPoolId(null);
      setEditingSharedPoolId(null);

      setName('');
      setNumbers([]);
      setIncludeNumbers([]);
      setExcludeNumbers([]);
      setSharedPoolId('');

      setGridOpen(false);
      setIncludeGridOpen(false);
      setExcludeGridOpen(false);
      setSharedGridOpen(false);

      setError(null);
    }, [isOpen]);

    const editingPool =
      useMemo(
        () =>
          savedPools.find(
            (pool) =>
              pool.id ===
              editingPoolId
          ),
        [
          savedPools,
          editingPoolId,
        ]
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

    const effectiveNumbers =
      useMemo(() => {
        const previewPool: CustomPool =
        {
          id: 'preview',
          name:
            name || 'Preview',
          numbers,
          sharedPoolId:
            sharedPoolId ||
            undefined,
          includeNumbers,
          excludeNumbers,
        };

        const base =
          getPoolNumbers(
            previewPool,
            sharedPools
          );

        const result = new Set(
          base
        );

        for (const number of includeNumbers) {
          result.add(number);
        }

        for (const number of excludeNumbers) {
          result.delete(number);
        }

        return Array.from(
          result
        ).sort(
          (a, b) => a - b
        );
      }, [
        name,
        numbers,
        sharedPoolId,
        includeNumbers,
        excludeNumbers,
        sharedPools,
      ]);

    const conflictNumbers =
      useMemo(
        () =>
          includeNumbers.filter(
            (number) =>
              excludeNumbers.includes(
                number
              )
          ),
        [
          includeNumbers,
          excludeNumbers,
        ]
      );

    const startCreatingPool =
      () => {
        setPoolView('editor');
        setEditingPoolId(null);

        setName('');
        setNumbers([]);
        setIncludeNumbers([]);
        setExcludeNumbers([]);
        setSharedPoolId('');

        setError(null);
      };

    const startEditingPool = (
      pool: CustomPool
    ) => {
      setPoolView('editor');
      setEditingPoolId(pool.id);

      setName(pool.name);
      setNumbers([
        ...(pool.numbers || []),
      ]);

      setIncludeNumbers([
        ...(pool.includeNumbers ||
          []),
      ]);

      setExcludeNumbers([
        ...(pool.excludeNumbers ||
          []),
      ]);

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

      if (
        numbers.length === 0 &&
        !sharedPoolId &&
        includeNumbers.length === 0
      ) {
        setError(
          'Add numbers, include numbers, or link a shared pool.'
        );
        return;
      }

      if (
        effectiveNumbers.length === 0
      ) {
        setError(
          'The pool must contain at least one available number.'
        );
        return;
      }

      const pool: CustomPool = {
        id:
          editingPoolId ||
          `custom-${Date.now()}`,

        name: name.trim(),

        numbers: [
          ...numbers,
        ],

        sharedPoolId:
          sharedPoolId ||
          undefined,

        includeNumbers: [
          ...includeNumbers,
        ],

        excludeNumbers: [
          ...excludeNumbers,
        ],

        description:
          describePool(
            {
              id:
                editingPoolId ||
                'preview',

              name:
                name.trim(),

              numbers,

              sharedPoolId:
                sharedPoolId ||
                undefined,

              includeNumbers,
              excludeNumbers,
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
      setIncludeNumbers([]);
      setExcludeNumbers([]);
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

    const startEditingSharedPool =
      (
        pool: SharedPool
      ) => {
        setSharedView('editor');
        setEditingSharedPoolId(
          pool.id
        );

        setName(pool.name);
        setNumbers([
          ...pool.numbers,
        ]);

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

        numbers: [
          ...numbers,
        ],

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

    const renderNumberPickerButton = (
      label: string,
      count: number,
      onClick: () => void,
      emptyText: string
    ) => (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-900 text-left"
      >
        <div>
          <div className="text-xs font-bold text-neutral-900">
            {count > 0
              ? `${count} number${count === 1
                ? ''
                : 's'
              } selected`
              : emptyText}
          </div>

          <div className="text-[10px] text-neutral-400 mt-0.5">
            Open 1–90 picker
          </div>
        </div>

        <Plus className="w-4 h-4 text-neutral-500" />
      </button>
    );

    if (!isOpen) {
      return null;
    }

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

          {/* Tabs */}

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
            {mainTab ===
              'pools' && (
                <>
                  {poolView ===
                    'list' ? (
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
                                (
                                  shared
                                ) =>
                                  shared.id ===
                                  pool.sharedPoolId
                              )
                              : undefined;

                          return (
                            <div
                              key={
                                pool.id
                              }
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
                                      {
                                        pool.name
                                      }
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
                                        {
                                          linkedShared.name
                                        }
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-[11px] text-neutral-400 mt-1">
                                    {describePool(
                                      pool,
                                      sharedPools
                                    )}
                                  </p>

                                  {(pool.includeNumbers?.length ||
                                    0) >
                                    0 && (
                                      <p className="text-[10px] text-neutral-500 mt-1">
                                        Include:{' '}
                                        {pool.includeNumbers?.join(
                                          ', '
                                        )}
                                      </p>
                                    )}

                                  {(pool.excludeNumbers?.length ||
                                    0) >
                                    0 && (
                                      <p className="text-[10px] text-red-500 mt-0.5">
                                        Exclude:{' '}
                                        {pool.excludeNumbers?.join(
                                          ', '
                                        )}
                                      </p>
                                    )}
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
                          setPoolView(
                            'list'
                          )
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
                          Set your base numbers and optional rules.
                        </p>
                      </div>

                      {/* Name */}

                      <div>
                        <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                          Pool name
                        </label>

                        <input
                          value={name}
                          onChange={(
                            event
                          ) =>
                            setName(
                              event.target
                                .value
                            )
                          }
                          maxLength={40}
                          placeholder="e.g. Office Raffle"
                          className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm outline-none focus:border-neutral-900"
                        />
                      </div>

                      {/* Own numbers */}

                      <div>
                        <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                          Your Numbers
                        </label>

                        {renderNumberPickerButton(
                          'Your Numbers',
                          numbers.length,
                          () =>
                            setGridOpen(
                              true
                            ),
                          'No own numbers yet'
                        )}
                      </div>

                      {/* Shared */}

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-neutral-700">
                            Borrow from shared pool
                          </label>

                          <Link2 className="w-4 h-4 text-neutral-400" />
                        </div>

                        <select
                          value={
                            sharedPoolId
                          }
                          onChange={(
                            event
                          ) =>
                            setSharedPoolId(
                              event.target
                                .value
                            )
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs outline-none focus:border-neutral-900"
                        >
                          <option value="">
                            None
                          </option>

                          {sharedPools.map(
                            (pool) => (
                              <option
                                key={
                                  pool.id
                                }
                                value={
                                  pool.id
                                }
                              >
                                {
                                  pool.name
                                }{' '}
                                (
                                {
                                  pool
                                    .numbers
                                    .length
                                }{' '}
                                numbers)
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      {/* Include */}

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-neutral-700">
                            Include Numbers
                          </label>

                          <span className="text-[10px] text-neutral-400">
                            Optional
                          </span>
                        </div>

                        {renderNumberPickerButton(
                          'Include Numbers',
                          includeNumbers.length,
                          () =>
                            setIncludeGridOpen(
                              true
                            ),
                          'No extra numbers'
                        )}
                      </div>

                      {/* Exclude */}

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-neutral-700">
                            Exclude Numbers
                          </label>

                          <span className="text-[10px] text-neutral-400">
                            Optional
                          </span>
                        </div>

                        {renderNumberPickerButton(
                          'Exclude Numbers',
                          excludeNumbers.length,
                          () =>
                            setExcludeGridOpen(
                              true
                            ),
                          'No excluded numbers'
                        )}
                      </div>

                      {/* Conflict */}

                      {conflictNumbers.length >
                        0 && (
                          <div className="flex gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
                            <AlertCircle className="w-4 h-4 shrink-0" />

                            <span>
                              {conflictNumbers.join(
                                ', '
                              )}{' '}
                              appear in both
                              Include and
                              Exclude. Exclude
                              will win.
                            </span>
                          </div>
                        )}

                      {/* Preview */}

                      <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wide text-neutral-400">
                            Available
                          </span>

                          <span className="text-sm font-black text-neutral-900">
                            {
                              effectiveNumbers.length
                            }
                          </span>
                        </div>

                        <div className="text-[10px] text-neutral-400 mt-1">
                          After Include/Exclude
                          rules.
                        </div>
                      </div>

                      {error && (
                        <div className="flex gap-2 items-start px-3 py-2.5 rounded-xl bg-red-50 border border-red-100 text-xs font-bold text-red-600">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {error}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 border-t border-neutral-100">
                        <button
                          onClick={() =>
                            setPoolView(
                              'list'
                            )
                          }
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100"
                        >
                          Cancel
                        </button>

                        <button
                          onClick={
                            savePool
                          }
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

            {/* -------------------------------------------------------- */}
            {/* Shared pools                                              */}
            {/* -------------------------------------------------------- */}

            {mainTab ===
              'shared' && (
                <>
                  {sharedView ===
                    'list' ? (
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
                              Create one to let
                              multiple custom
                              pools borrow the
                              same numbers.
                            </p>
                          </div>
                        )}

                      {sharedPools.map(
                        (pool) => {
                          const linkedCount =
                            savedPools.filter(
                              (
                                custom
                              ) =>
                                custom.sharedPoolId ===
                                pool.id
                            ).length;

                          return (
                            <div
                              key={
                                pool.id
                              }
                              className="rounded-xl border border-neutral-200 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-xs font-black text-neutral-900">
                                    {
                                      pool.name
                                    }
                                  </div>

                                  <div className="text-[10px] text-neutral-400 mt-1">
                                    {
                                      pool
                                        .numbers
                                        .length
                                    }{' '}
                                    numbers
                                    {linkedCount >
                                      0 &&
                                      ` • ${linkedCount} custom pool${linkedCount ===
                                        1
                                        ? ''
                                        : 's'
                                      }`}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
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
                            </div>
                          );
                        }
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <button
                        onClick={() =>
                          setSharedView(
                            'list'
                          )
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
                          Create numbers that can be reused by multiple pools.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                          Pool name
                        </label>

                        <input
                          value={name}
                          onChange={(
                            event
                          ) =>
                            setName(
                              event.target
                                .value
                            )
                          }
                          maxLength={40}
                          placeholder="e.g. Weekend Numbers"
                          className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm outline-none focus:border-neutral-900"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                          Numbers
                        </label>

                        {renderNumberPickerButton(
                          'Numbers',
                          numbers.length,
                          () =>
                            setSharedGridOpen(
                              true
                            ),
                          'No numbers yet'
                        )}
                      </div>

                      {error && (
                        <div className="flex gap-2 items-start px-3 py-2.5 rounded-xl bg-red-50 border border-red-100 text-xs font-bold text-red-600">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {error}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 border-t border-neutral-100">
                        <button
                          onClick={() =>
                            setSharedView(
                              'list'
                            )
                          }
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100"
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
                            : 'Create pool'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
          </div>
        </div>

        {/* Your numbers picker */}

        <NumberGridPicker
          isOpen={gridOpen}
          onClose={() =>
            setGridOpen(false)
          }
          selectedNumbers={
            numbers
          }
          onChange={
            setNumbers
          }
        />

        {/* Include picker */}

        <NumberGridPicker
          isOpen={
            includeGridOpen
          }
          onClose={() =>
            setIncludeGridOpen(
              false
            )
          }
          selectedNumbers={
            includeNumbers
          }
          onChange={
            setIncludeNumbers
          }
        />

        {/* Exclude picker */}

        <NumberGridPicker
          isOpen={
            excludeGridOpen
          }
          onClose={() =>
            setExcludeGridOpen(
              false
            )
          }
          selectedNumbers={
            excludeNumbers
          }
          onChange={
            setExcludeNumbers
          }
        />

        {/* Shared picker */}

        <NumberGridPicker
          isOpen={
            sharedGridOpen
          }
          onClose={() =>
            setSharedGridOpen(
              false
            )
          }
          selectedNumbers={
            numbers
          }
          onChange={
            setNumbers
          }
        />
      </div>
    );
  };