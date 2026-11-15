import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import {
  getTodayDateString,
  type PriorityLevel,
  type TaskItem,
} from '../types/chrono';
import { TactileCheckbox } from './TactileCheckbox';
import { soundEngine } from '../utils/soundEngine';

interface TasksSectionProps {
  tasks: TaskItem[];
  autoOpenCreateKey?: number;
  defaultCreateDate?: string;
  onToggleTask: (id: string) => void;
  onCreateTask: (task: Omit<TaskItem, 'id' | 'completed'>) => void;
  onUpdateTask: (id: string, updates: Omit<TaskItem, 'id'>) => void;
  onDeleteTask: (id: string) => void;
}

type TaskFilter = 'all' | 'today' | 'pending' | 'completed';

const PRIORITY_STYLES: Record<PriorityLevel, { label: string; textClass: string }> = {
  high: { label: 'High priority', textClass: 'text-amber-600 dark:text-[#F59E0B]' },
  medium: { label: 'Medium priority', textClass: 'text-indigo-600 dark:text-[#818CF8]' },
  low: { label: 'Low priority', textClass: 'text-slate-500 dark:text-[#94A3B8]' },
};

export const TasksSection: React.FC<TasksSectionProps> = ({
  tasks,
  autoOpenCreateKey,
  defaultCreateDate,
  onToggleTask,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}) => {
  const today = getTodayDateString();
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | PriorityLevel>('all');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(today);
  const [dueTime, setDueTime] = useState('14:00');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [details, setDetails] = useState('');

  const openCreate = (dateOverride?: string) => {
    soundEngine.playTick(840, 0.02);
    setEditingTask(null);
    setTitle('');
    setDueDate(dateOverride || today);
    setDueTime('14:00');
    setDurationMinutes(30);
    setPriority('medium');
    setDetails('');
    setEditorOpen(true);
  };

  useEffect(() => {
    if (autoOpenCreateKey && autoOpenCreateKey > 0) {
      openCreate(defaultCreateDate);
    }
  }, [autoOpenCreateKey, defaultCreateDate]);

  const openEdit = (task: TaskItem) => {
    soundEngine.playTick(800, 0.02);
    setEditingTask(task);
    setTitle(task.title);
    setDueDate(task.dueDate);
    setDueTime(task.dueTime);
    setDurationMinutes(task.durationMinutes);
    setPriority(task.priority ?? 'medium');
    setDetails(task.details ?? '');
    setEditorOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    soundEngine.playTick(980, 0.03);

    if (editingTask) {
      onUpdateTask(editingTask.id, {
        title: title.trim(),
        dueDate,
        dueTime,
        durationMinutes,
        priority,
        completed: editingTask.completed,
        details: details.trim() || undefined,
      });
    } else {
      onCreateTask({
        title: title.trim(),
        dueDate,
        dueTime,
        durationMinutes,
        priority,
        details: details.trim() || undefined,
      });
    }
    setEditorOpen(false);
    setEditingTask(null);
  };

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const weight: Record<PriorityLevel, number> = { high: 0, medium: 1, low: 2 };
    return tasks
      .filter((t) => {
        if (filter === 'today') return t.dueDate === today;
        if (filter === 'pending') return !t.completed;
        if (filter === 'completed') return t.completed;
        return true;
      })
      .filter((t) =>
        priorityFilter === 'all' ? true : (t.priority ?? 'medium') === priorityFilter
      )
      .filter((t) =>
        q
          ? t.title.toLowerCase().includes(q) ||
            (t.details ?? '').toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pDiff =
          weight[a.priority ?? 'medium'] - weight[b.priority ?? 'medium'];
        if (pDiff !== 0) return pDiff;
        return `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`);
      });
  }, [tasks, filter, priorityFilter, search, today]);

  const pendingCount = tasks.filter((t) => !t.completed).length;

  return (
    <section className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            Tasks
          </h2>
          <p className="text-xs text-slate-600 dark:text-[#94A3B8] tabular-nums mt-0.5">
            {pendingCount} pending · {tasks.length} total
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreate()}
          className="flex min-h-[44px] items-center gap-2 rounded-full bg-gradient-to-r from-[#6366F1] to-[#818CF8] px-5 py-2 text-xs font-semibold text-white shadow-[0_0_16px_rgba(99,102,241,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Filter tasks"
            className="inline-flex rounded-full bg-slate-100 dark:bg-[#12141F] p-1 border border-slate-200 dark:border-white/[0.06]"
          >
            {(['all', 'today', 'pending', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={filter === tab}
                onClick={() => {
                  soundEngine.playTick(780, 0.02);
                  setFilter(tab);
                }}
                className={`min-h-[36px] rounded-full px-3.5 text-xs font-medium capitalize transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === tab
                    ? 'bg-white dark:bg-[#1A1D2D] text-slate-900 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/15 shadow-xs'
                    : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] border border-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value as 'all' | PriorityLevel)
            }
            className="min-h-[40px] rounded-full bg-white dark:bg-[#12141F] px-3.5 text-xs font-medium text-slate-700 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/[0.08] focus:border-[#6366F1] focus:outline-none cursor-pointer"
          >
            <option value="all">All priorities</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </select>
        </div>

        <div className="relative w-full lg:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-[#64748B]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            aria-label="Search tasks"
            className="min-h-[44px] w-full rounded-full bg-white dark:bg-[#12141F] pl-10 pr-4 text-sm text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-[#64748B] border border-slate-200 dark:border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
          />
        </div>
      </div>

      {/* Create / Edit Form */}
      {editorOpen && (
        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] bg-white dark:bg-[#1A1D2D] border border-indigo-300 dark:border-[#6366F1]/40 p-5 flex flex-col gap-4 shadow-lg dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-[#F8FAFC]">
              {editingTask ? 'Edit Task' : 'Create Task'}
            </h3>
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              aria-label="Close task form"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#F8FAFC] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label
              htmlFor="task-title-input"
              className="block text-xs font-medium text-slate-600 dark:text-[#94A3B8] mb-1.5"
            >
              Task Title
            </label>
            <input
              id="task-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Review quarterly roadmap"
              required
              className="min-h-[48px] w-full rounded-2xl bg-slate-50 dark:bg-[#161926] px-4 text-sm text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-[#64748B] border border-slate-200 dark:border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="task-date-input"
                className="block text-xs font-medium text-slate-600 dark:text-[#94A3B8] mb-1.5"
              >
                Date
              </label>
              <input
                id="task-date-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="min-h-[48px] w-full rounded-2xl bg-slate-50 dark:bg-[#161926] px-3 font-mono text-xs text-slate-900 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="task-time-input"
                className="block text-xs font-medium text-slate-600 dark:text-[#94A3B8] mb-1.5"
              >
                Time
              </label>
              <input
                id="task-time-input"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="min-h-[48px] w-full rounded-2xl bg-slate-50 dark:bg-[#161926] px-3 font-mono text-xs text-slate-900 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="task-duration-input"
                className="block text-xs font-medium text-slate-600 dark:text-[#94A3B8] mb-1.5"
              >
                Duration (m)
              </label>
              <input
                id="task-duration-input"
                type="number"
                min={5}
                max={360}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value) || 30)}
                className="min-h-[48px] w-full rounded-2xl bg-slate-50 dark:bg-[#161926] px-3 font-mono text-sm text-slate-900 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-600 dark:text-[#94A3B8] mb-1.5">
                Priority
              </span>
              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 dark:bg-[#12141F] p-1 border border-slate-200 dark:border-white/[0.06] min-h-[48px]">
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`rounded-xl text-xs font-medium capitalize transition-all cursor-pointer ${
                      priority === p
                        ? p === 'high'
                          ? 'bg-amber-500/20 text-amber-700 dark:text-[#F59E0B] border border-amber-500/40'
                          : p === 'medium'
                            ? 'bg-indigo-500/15 text-indigo-700 dark:text-[#818CF8] border border-indigo-500/40'
                            : 'bg-white dark:bg-[#1A1D2D] text-slate-900 dark:text-[#F8FAFC] border border-slate-300 dark:border-white/15'
                        : 'text-slate-500 dark:text-[#94A3B8]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="task-details-input"
              className="block text-xs font-medium text-slate-600 dark:text-[#94A3B8] mb-1.5"
            >
              Details (optional)
            </label>
            <input
              id="task-details-input"
              type="text"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Context or checklist summary..."
              className="min-h-[48px] w-full rounded-2xl bg-slate-50 dark:bg-[#161926] px-4 text-sm text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-[#64748B] border border-slate-200 dark:border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="min-h-[44px] rounded-full px-5 text-xs font-medium text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] rounded-full bg-gradient-to-r from-[#6366F1] to-[#818CF8] px-6 text-xs font-semibold text-white shadow-[0_0_16px_rgba(99,102,241,0.4)] cursor-pointer"
            >
              {editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-[28px] bg-white/70 dark:bg-[#1A1D2D]/50 border border-slate-200 dark:border-white/[0.06] p-8 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-[#F8FAFC]">
            No tasks found
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#64748B]">
            Add a task or adjust your filter to see upcoming items.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredTasks.map((task) => {
            const pInfo = PRIORITY_STYLES[task.priority ?? 'medium'];
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-[24px] bg-white dark:bg-[#1A1D2D]/75 border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/15 p-3.5 sm:p-4 transition-all shadow-xs dark:shadow-none"
              >
                <TactileCheckbox
                  checked={task.completed}
                  onChange={() => onToggleTask(task.id)}
                  ariaLabel={`Mark ${task.title} complete`}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-500 dark:text-[#94A3B8]">
                    <span className="text-slate-900 dark:text-[#F8FAFC]">
                      {task.dueDate === today ? 'Today' : task.dueDate}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{task.dueTime}</span>
                    <span aria-hidden="true">·</span>
                    <span>{task.durationMinutes}m</span>
                    <span aria-hidden="true">·</span>
                    <span className={`font-sans font-medium ${pInfo.textClass}`}>
                      {pInfo.label}
                    </span>
                  </div>

                  <p
                    className={`mt-0.5 truncate text-[15px] font-medium ${
                      task.completed
                        ? 'line-through text-slate-400 dark:text-[#64748B]'
                        : 'text-slate-900 dark:text-[#F8FAFC]'
                    }`}
                  >
                    {task.title}
                  </p>

                  {task.details && !task.completed && (
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-[#64748B]">
                      {task.details}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(task)}
                    aria-label={`Edit ${task.title}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTask(task.id)}
                    aria-label={`Delete ${task.title}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 dark:text-[#64748B] hover:bg-red-50 dark:hover:bg-white/[0.06] hover:text-red-600 dark:hover:text-[#ffb4ab] transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
