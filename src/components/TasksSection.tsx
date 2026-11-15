import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import {
  getTodayDateString,
  type TaskItem,
  type TaskPriority,
} from '../types/chrono';
import { TactileCheckbox } from './TactileCheckbox';
import { soundEngine } from '../utils/soundEngine';

interface TasksSectionProps {
  tasks: TaskItem[];
  onToggleTask: (id: string) => void;
  onCreateTask: (task: Omit<TaskItem, 'id' | 'completed'>) => void;
  onUpdateTask: (id: string, updates: Omit<TaskItem, 'id'>) => void;
  onDeleteTask: (id: string) => void;
}

type TaskFilter = 'all' | 'today' | 'pending' | 'completed';

export const TasksSection: React.FC<TasksSectionProps> = ({
  tasks,
  onToggleTask,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}) => {
  const today = getTodayDateString();
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(today);
  const [dueTime, setDueTime] = useState('14:00');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [details, setDetails] = useState('');

  const openCreate = () => {
    soundEngine.playTick(840, 0.02);
    setEditingTask(null);
    setTitle('');
    setDueDate(today);
    setDueTime('14:00');
    setDurationMinutes(30);
    setPriority('normal');
    setDetails('');
    setEditorOpen(true);
  };

  const openEdit = (task: TaskItem) => {
    soundEngine.playTick(800, 0.02);
    setEditingTask(task);
    setTitle(task.title);
    setDueDate(task.dueDate);
    setDueTime(task.dueTime);
    setDurationMinutes(task.durationMinutes);
    setPriority(task.priority);
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
    return tasks
      .filter((t) => {
        if (filter === 'today') return t.dueDate === today;
        if (filter === 'pending') return !t.completed;
        if (filter === 'completed') return t.completed;
        return true;
      })
      .filter((t) =>
        q
          ? t.title.toLowerCase().includes(q) ||
            (t.details ?? '').toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`);
      });
  }, [tasks, filter, search, today]);

  const pendingCount = tasks.filter((t) => !t.completed).length;

  return (
    <section className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#F8FAFC] tracking-tight">
            Tasks
          </h2>
          <p className="text-xs text-[#94A3B8] tabular-nums mt-0.5">
            {pendingCount} pending · {tasks.length} total
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#6366F1] to-[#818CF8] px-5 text-xs font-semibold text-white shadow-[0_0_16px_rgba(99,102,241,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter tasks"
          className="inline-flex self-start rounded-full bg-[#12141F] p-1 border border-white/[0.06]"
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
              className={`min-h-[38px] rounded-full px-4 text-xs font-medium capitalize transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                filter === tab
                  ? 'bg-[#1A1D2D] text-[#F8FAFC] border border-white/15'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            aria-label="Search tasks"
            className="h-11 w-full rounded-full bg-[#12141F] pl-10 pr-4 text-sm text-[#F8FAFC] placeholder:text-[#64748B] border border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
          />
        </div>
      </div>

      {/* Create / Edit Form */}
      {editorOpen && (
        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] bg-[#1A1D2D] border border-[#6366F1]/40 p-5 flex flex-col gap-4 shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#F8FAFC]">
              {editingTask ? 'Edit Task' : 'Create Task'}
            </h3>
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              aria-label="Close task form"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#94A3B8] hover:bg-white/5 hover:text-[#F8FAFC] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label
              htmlFor="task-title-input"
              className="block text-xs font-medium text-[#94A3B8] mb-1.5"
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
              className="h-[48px] w-full rounded-2xl bg-[#161926] px-4 text-sm text-[#F8FAFC] placeholder:text-[#64748B] border border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="task-date-input"
                className="block text-xs font-medium text-[#94A3B8] mb-1.5"
              >
                Date
              </label>
              <input
                id="task-date-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-[48px] w-full rounded-2xl bg-[#161926] px-3 font-mono text-xs text-[#F8FAFC] border border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="task-time-input"
                className="block text-xs font-medium text-[#94A3B8] mb-1.5"
              >
                Time
              </label>
              <input
                id="task-time-input"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="h-[48px] w-full rounded-2xl bg-[#161926] px-3 font-mono text-xs text-[#F8FAFC] border border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="task-duration-input"
                className="block text-xs font-medium text-[#94A3B8] mb-1.5"
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
                className="h-[48px] w-full rounded-2xl bg-[#161926] px-3 font-mono text-sm text-[#F8FAFC] border border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Priority
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#12141F] p-1 border border-white/[0.06] h-[48px]">
                {(['normal', 'high'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`rounded-xl text-xs font-medium capitalize transition-all cursor-pointer ${
                      priority === p
                        ? p === 'high'
                          ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
                          : 'bg-[#1A1D2D] text-[#F8FAFC] border border-white/15'
                        : 'text-[#94A3B8]'
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
              className="block text-xs font-medium text-[#94A3B8] mb-1.5"
            >
              Details (optional)
            </label>
            <input
              id="task-details-input"
              type="text"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Context or checklist summary..."
              className="h-[48px] w-full rounded-2xl bg-[#161926] px-4 text-sm text-[#F8FAFC] placeholder:text-[#64748B] border border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="h-11 rounded-full px-5 text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-11 rounded-full bg-gradient-to-r from-[#6366F1] to-[#818CF8] px-6 text-xs font-semibold text-white shadow-[0_0_16px_rgba(99,102,241,0.4)] cursor-pointer"
            >
              {editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-[28px] bg-[#1A1D2D]/50 border border-white/[0.06] p-8 text-center">
          <p className="text-sm font-medium text-[#F8FAFC]">No tasks found</p>
          <p className="mt-1 text-xs text-[#64748B]">
            Add a task or adjust your filter to see upcoming items.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-[24px] bg-[#1A1D2D]/70 border border-white/[0.08] hover:border-white/15 p-3.5 sm:p-4 transition-all"
            >
              <TactileCheckbox
                checked={task.completed}
                onChange={() => onToggleTask(task.id)}
                ariaLabel={`Mark ${task.title} complete`}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-[#94A3B8]">
                  <span className="text-[#F8FAFC]">
                    {task.dueDate === today ? 'Today' : task.dueDate}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{task.dueTime}</span>
                  <span aria-hidden="true">·</span>
                  <span>{task.durationMinutes}m</span>
                  {task.priority === 'high' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#F59E0B] font-sans font-medium">
                        High priority
                      </span>
                    </>
                  )}
                </div>

                <p
                  className={`mt-0.5 truncate text-[15px] font-medium ${
                    task.completed ? 'line-through text-[#64748B]' : 'text-[#F8FAFC]'
                  }`}
                >
                  {task.title}
                </p>

                {task.details && !task.completed && (
                  <p className="mt-0.5 truncate text-xs text-[#64748B]">
                    {task.details}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(task)}
                  aria-label={`Edit ${task.title}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[#94A3B8] hover:bg-white/[0.06] hover:text-[#F8FAFC] transition-colors cursor-pointer"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteTask(task.id)}
                  aria-label={`Delete ${task.title}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[#64748B] hover:bg-white/[0.06] hover:text-[#ffb4ab] transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
