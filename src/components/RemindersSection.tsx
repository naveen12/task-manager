import React, { useMemo, useState } from 'react';
import { Bell, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  getTodayDateString,
  type ReminderItem,
  type ReminderRepeat,
} from '../types/chrono';
import { GlowingToggle } from './GlowingToggle';
import { TactileCheckbox } from './TactileCheckbox';
import { soundEngine } from '../utils/soundEngine';

interface RemindersSectionProps {
  reminders: ReminderItem[];
  onCreateReminder: (item: Omit<ReminderItem, 'id' | 'completed'>) => void;
  onUpdateReminder: (id: string, updates: Omit<ReminderItem, 'id'>) => void;
  onDeleteReminder: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onToggleCompleted: (id: string) => void;
}

type ReminderFilter = 'all' | 'active' | 'completed';

export const RemindersSection: React.FC<RemindersSectionProps> = ({
  reminders,
  onCreateReminder,
  onUpdateReminder,
  onDeleteReminder,
  onToggleActive,
  onToggleCompleted,
}) => {
  const today = getTodayDateString();
  const [filter, setFilter] = useState<ReminderFilter>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(
    null
  );

  // Form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('17:00');
  const [repeat, setRepeat] = useState<ReminderRepeat>('once');
  const [note, setNote] = useState('');

  const openCreate = () => {
    soundEngine.playTick(840, 0.02);
    setEditingReminder(null);
    setTitle('');
    setDate(today);
    setTime('17:00');
    setRepeat('once');
    setNote('');
    setEditorOpen(true);
  };

  const openEdit = (item: ReminderItem) => {
    soundEngine.playTick(800, 0.02);
    setEditingReminder(item);
    setTitle(item.title);
    setDate(item.date);
    setTime(item.time);
    setRepeat(item.repeat);
    setNote(item.note ?? '');
    setEditorOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    soundEngine.playTick(980, 0.03);

    if (editingReminder) {
      onUpdateReminder(editingReminder.id, {
        title: title.trim(),
        date,
        time,
        repeat,
        active: editingReminder.active,
        completed: editingReminder.completed,
        note: note.trim() || undefined,
      });
    } else {
      onCreateReminder({
        title: title.trim(),
        date,
        time,
        repeat,
        active: true,
        note: note.trim() || undefined,
      });
    }
    setEditorOpen(false);
    setEditingReminder(null);
  };

  const filtered = useMemo(() => {
    return reminders
      .filter((r) => {
        if (filter === 'active') return r.active && !r.completed;
        if (filter === 'completed') return r.completed;
        return true;
      })
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [reminders, filter]);

  const activeCount = reminders.filter((r) => r.active && !r.completed).length;

  return (
    <section className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#F8FAFC] tracking-tight">
            Reminders
          </h2>
          <p className="text-xs text-[#94A3B8] tabular-nums mt-0.5">
            {activeCount} scheduled · {reminders.length} total
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#6366F1] to-[#818CF8] px-5 text-xs font-semibold text-white shadow-[0_0_16px_rgba(99,102,241,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          New Reminder
        </button>
      </div>

      {/* Filter Segmented Control */}
      <div
        role="tablist"
        aria-label="Filter reminders"
        className="inline-flex self-start rounded-full bg-[#12141F] p-1 border border-white/[0.06]"
      >
        {(['all', 'active', 'completed'] as const).map((tab) => (
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

      {/* Create / Edit Form */}
      {editorOpen && (
        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] bg-[#1A1D2D] border border-[#6366F1]/40 p-5 flex flex-col gap-4 shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#F8FAFC]">
              {editingReminder ? 'Edit Reminder' : 'Create Reminder'}
            </h3>
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              aria-label="Close reminder form"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#94A3B8] hover:bg-white/5 hover:text-[#F8FAFC] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label
              htmlFor="rem-title-input"
              className="block text-xs font-medium text-[#94A3B8] mb-1.5"
            >
              Reminder Title
            </label>
            <input
              id="rem-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Call supplier before 4 PM"
              required
              className="h-[48px] w-full rounded-2xl bg-[#161926] px-4 text-sm text-[#F8FAFC] placeholder:text-[#64748B] border border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="rem-date-input"
                className="block text-xs font-medium text-[#94A3B8] mb-1.5"
              >
                Date
              </label>
              <input
                id="rem-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-[48px] w-full rounded-2xl bg-[#161926] px-3.5 font-mono text-xs text-[#F8FAFC] border border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="rem-time-input"
                className="block text-xs font-medium text-[#94A3B8] mb-1.5"
              >
                Time
              </label>
              <input
                id="rem-time-input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-[48px] w-full rounded-2xl bg-[#161926] px-3.5 font-mono text-xs text-[#F8FAFC] border border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="rem-repeat-select"
                className="block text-xs font-medium text-[#94A3B8] mb-1.5"
              >
                Repeat
              </label>
              <select
                id="rem-repeat-select"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as ReminderRepeat)}
                className="h-[48px] w-full rounded-2xl bg-[#161926] px-3.5 text-sm text-[#F8FAFC] border border-white/[0.08] focus:border-[#6366F1] focus:outline-none cursor-pointer"
              >
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="rem-note-input"
              className="block text-xs font-medium text-[#94A3B8] mb-1.5"
            >
              Note (optional)
            </label>
            <input
              id="rem-note-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Extra context for this alert..."
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
              {editingReminder ? 'Save Changes' : 'Create Reminder'}
            </button>
          </div>
        </form>
      )}

      {/* Reminders List */}
      {filtered.length === 0 ? (
        <div className="rounded-[28px] bg-[#1A1D2D]/50 border border-white/[0.06] p-8 text-center">
          <Bell className="mx-auto h-6 w-6 text-[#64748B] mb-2" />
          <p className="text-sm font-medium text-[#F8FAFC]">No reminders here</p>
          <p className="mt-1 text-xs text-[#64748B]">
            Create a reminder so you never miss a time-sensitive checkpoint.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-[24px] bg-[#1A1D2D]/70 border border-white/[0.08] hover:border-white/15 p-3.5 sm:p-4 transition-all"
            >
              <TactileCheckbox
                checked={item.completed}
                onChange={() => onToggleCompleted(item.id)}
                ariaLabel={`Mark reminder ${item.title} done`}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-[#94A3B8]">
                  <span className="text-[#F8FAFC]">
                    {item.date === today ? 'Today' : item.date}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#818CF8]">{item.time}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize font-sans">{item.repeat}</span>
                </div>

                <p
                  className={`mt-0.5 truncate text-[15px] font-medium ${
                    item.completed ? 'line-through text-[#64748B]' : 'text-[#F8FAFC]'
                  }`}
                >
                  {item.title}
                </p>

                {item.note && !item.completed && (
                  <p className="mt-0.5 truncate text-xs text-[#64748B]">
                    {item.note}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <GlowingToggle
                  checked={item.active}
                  onChange={(next) => onToggleActive(item.id, next)}
                  ariaLabel={`Toggle reminder ${item.title}`}
                />
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  aria-label={`Edit ${item.title}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[#94A3B8] hover:bg-white/[0.06] hover:text-[#F8FAFC] transition-colors cursor-pointer"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteReminder(item.id)}
                  aria-label={`Delete ${item.title}`}
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
