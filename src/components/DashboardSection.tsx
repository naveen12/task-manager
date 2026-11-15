import React, { useEffect, useState } from 'react';
import {
  AlarmClock,
  ArrowRight,
  Bell,
  CheckSquare,
  FileText,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  getTodayDateString,
  type ChronoAlarm,
  type NavTab,
  type NoteItem,
  type ReminderItem,
  type TaskItem,
} from '../types/chrono';
import { TactileCheckbox } from './TactileCheckbox';
import { GlowingToggle } from './GlowingToggle';
import { soundEngine } from '../utils/soundEngine';

interface DashboardSectionProps {
  tasks: TaskItem[];
  reminders: ReminderItem[];
  alarms: ChronoAlarm[];
  notes: NoteItem[];
  onNavigate: (tab: NavTab) => void;
  onToggleTask: (id: string) => void;
  onToggleReminderDone: (id: string) => void;
  onToggleAlarm: (id: string, enabled: boolean) => void;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  tasks,
  reminders,
  alarms,
  notes,
  onNavigate,
  onToggleTask,
  onToggleReminderDone,
  onToggleAlarm,
}) => {
  const today = getTodayDateString();
  const todayWeekday = new Date().getDay();

  // Compact Focus Timer widget right on Dashboard
  const [focusPreset, setFocusPreset] = useState<number>(25);
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [running, setRunning] = useState<boolean>(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          setRunning(false);
          soundEngine.playCompletionChime();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const todayTasks = tasks
    .filter((t) => t.dueDate === today)
    .sort((a, b) => a.dueTime.localeCompare(b.dueTime));
  const completedTasksToday = todayTasks.filter((t) => t.completed).length;

  const todayReminders = reminders
    .filter(
      (r) =>
        r.date === today ||
        r.repeat === 'daily' ||
        (r.repeat === 'weekdays' && todayWeekday >= 1 && todayWeekday <= 5)
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  const pendingRemindersToday = todayReminders.filter((r) => !r.completed).length;

  const activeAlarms = alarms
    .filter((a) => a.enabled)
    .sort((a, b) => a.hour24 * 60 + a.minute - (b.hour24 * 60 + b.minute));

  const recentNotes = [...notes]
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 3);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progress = Math.max(0, Math.min(1, secondsLeft / (focusPreset * 60)));
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - progress);

  return (
    <section className="flex flex-col gap-6">
      {/* Today's Activity KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => onNavigate('tasks')}
          className="text-left rounded-[24px] bg-[#1A1D2D]/75 border border-white/[0.08] hover:border-[#6366F1]/40 p-4 sm:p-5 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[#94A3B8]">
            <span>Today&apos;s Tasks</span>
            <CheckSquare className="h-4 w-4 text-[#818CF8]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#F8FAFC] tabular-nums">
            {completedTasksToday}/{todayTasks.length}
          </p>
          <p className="mt-0.5 text-xs text-[#64748B]">Completed today</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('reminders')}
          className="text-left rounded-[24px] bg-[#1A1D2D]/75 border border-white/[0.08] hover:border-[#10B981]/40 p-4 sm:p-5 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[#94A3B8]">
            <span>Reminders</span>
            <Bell className="h-4 w-4 text-[#34D399]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#F8FAFC] tabular-nums">
            {pendingRemindersToday}
          </p>
          <p className="mt-0.5 text-xs text-[#64748B]">Due today</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('alarms')}
          className="text-left rounded-[24px] bg-[#1A1D2D]/75 border border-white/[0.08] hover:border-[#F59E0B]/40 p-4 sm:p-5 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[#94A3B8]">
            <span>Active Alarms</span>
            <AlarmClock className="h-4 w-4 text-[#F59E0B]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#F8FAFC] tabular-nums">
            {activeAlarms.length}
          </p>
          <p className="mt-0.5 text-xs text-[#64748B]">Armed</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('notes')}
          className="text-left rounded-[24px] bg-[#1A1D2D]/75 border border-white/[0.08] hover:border-white/25 p-4 sm:p-5 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[#94A3B8]">
            <span>Notes</span>
            <FileText className="h-4 w-4 text-[#c0c1ff]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-[#F8FAFC] tabular-nums">
            {notes.length}
          </p>
          <p className="mt-0.5 text-xs text-[#64748B]">
            {notes.filter((n) => n.pinned).length} pinned
          </p>
        </button>
      </div>

      {/* Main 2-Column Today Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Today's Tasks & Today's Reminders */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Today's Tasks */}
          <div className="rounded-[28px] bg-[#1A1D2D]/75 border border-white/[0.08] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-[#F8FAFC]">
                  Today&apos;s Tasks
                </h2>
                <p className="text-xs text-[#94A3B8] tabular-nums">
                  {todayTasks.length} scheduled for today
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tasks')}
                className="flex items-center gap-1.5 text-xs font-medium text-[#818CF8] hover:text-[#c0c1ff] transition-colors cursor-pointer"
              >
                Manage Tasks
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {todayTasks.length === 0 ? (
              <p className="text-sm text-[#64748B] py-4">
                No tasks scheduled for today. Add one in Tasks.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {todayTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <TactileCheckbox
                      checked={task.completed}
                      onChange={() => onToggleTask(task.id)}
                      ariaLabel={`Complete ${task.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-medium ${
                          task.completed
                            ? 'line-through text-[#64748B]'
                            : 'text-[#F8FAFC]'
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="text-xs font-mono text-[#94A3B8] tabular-nums">
                        {task.dueTime} · {task.durationMinutes}m
                        {task.priority === 'high' ? ' · High priority' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's Reminders */}
          <div className="rounded-[28px] bg-[#1A1D2D]/75 border border-white/[0.08] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-[#F8FAFC]">
                  Today&apos;s Reminders
                </h2>
                <p className="text-xs text-[#94A3B8] tabular-nums">
                  {pendingRemindersToday} active alerts left today
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('reminders')}
                className="flex items-center gap-1.5 text-xs font-medium text-[#34D399] hover:text-[#6ffbbe] transition-colors cursor-pointer"
              >
                Manage Reminders
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {todayReminders.length === 0 ? (
              <p className="text-sm text-[#64748B] py-4">
                No reminders scheduled for today.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {todayReminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <TactileCheckbox
                      checked={rem.completed}
                      onChange={() => onToggleReminderDone(rem.id)}
                      ariaLabel={`Complete reminder ${rem.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-medium ${
                          rem.completed
                            ? 'line-through text-[#64748B]'
                            : 'text-[#F8FAFC]'
                        }`}
                      >
                        {rem.title}
                      </p>
                      <p className="text-xs font-mono text-[#94A3B8] tabular-nums">
                        {rem.time} · <span className="capitalize font-sans">{rem.repeat}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quick Focus Chronometer, Active Alarms, Pinned Notes */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Quick Focus Chronometer Card */}
          <div className="rounded-[28px] bg-[#1A1D2D]/80 border border-white/[0.08] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#F8FAFC]">
                Focus Timer
              </h2>
              <div className="flex items-center gap-1.5">
                {[15, 25, 45].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      soundEngine.playTick(800, 0.02);
                      setRunning(false);
                      setFocusPreset(m);
                      setSecondsLeft(m * 60);
                    }}
                    className={`min-h-[32px] rounded-full px-3 text-xs font-medium tabular-nums transition-colors cursor-pointer ${
                      focusPreset === m
                        ? 'bg-[#6366F1]/25 text-[#c0c1ff] border border-[#6366F1]/45'
                        : 'bg-[#12141F] text-[#94A3B8] border border-white/[0.06]'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="relative h-[124px] w-[124px] shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 124 124" aria-hidden="true">
                  <circle
                    cx="62"
                    cy="62"
                    r={r}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="62"
                    cy="62"
                    r={r}
                    fill="none"
                    stroke="#6366F1"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={dashOffset}
                    className="transition-[stroke-dashoffset] duration-300 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-semibold text-[#F8FAFC] tabular-nums">
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playTick(running ? 620 : 940, 0.03);
                    if (secondsLeft === 0) setSecondsLeft(focusPreset * 60);
                    setRunning((v) => !v);
                  }}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#6366F1] to-[#818CF8] text-xs font-semibold text-white shadow-[0_0_16px_rgba(99,102,241,0.4)] cursor-pointer"
                >
                  {running ? (
                    <>
                      <Pause className="h-3.5 w-3.5 fill-current" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Start Focus
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playTick(600, 0.02);
                    setRunning(false);
                    setSecondsLeft(focusPreset * 60);
                  }}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-white/[0.05] text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] border border-white/10 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Alarms Snapshot */}
          <div className="rounded-[28px] bg-[#1A1D2D]/75 border border-white/[0.08] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-[#F8FAFC]">Alarms</h2>
              <button
                type="button"
                onClick={() => onNavigate('alarms')}
                className="flex items-center gap-1.5 text-xs font-medium text-[#F59E0B] hover:text-[#fbbf24] transition-colors cursor-pointer"
              >
                Manage Alarms
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {alarms.slice(0, 3).map((alarm) => {
                const h12 = alarm.hour24 % 12 || 12;
                const period = alarm.hour24 >= 12 ? 'PM' : 'AM';
                return (
                  <div
                    key={alarm.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="font-mono text-lg font-semibold text-[#F8FAFC] tabular-nums">
                        {String(h12).padStart(2, '0')}:
                        {String(alarm.minute).padStart(2, '0')}{' '}
                        <span className="text-xs text-[#F59E0B]">{period}</span>
                      </div>
                      <p className="text-xs text-[#94A3B8]">{alarm.label}</p>
                    </div>
                    <GlowingToggle
                      checked={alarm.enabled}
                      onChange={(next) => onToggleAlarm(alarm.id, next)}
                      ariaLabel={`Toggle ${alarm.label}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Notes Snapshot */}
          <div className="rounded-[28px] bg-[#1A1D2D]/75 border border-white/[0.08] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-[#F8FAFC]">Recent Notes</h2>
              <button
                type="button"
                onClick={() => onNavigate('notes')}
                className="flex items-center gap-1.5 text-xs font-medium text-[#818CF8] hover:text-[#c0c1ff] transition-colors cursor-pointer"
              >
                All Notes
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {recentNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onNavigate('notes')}
                  className="w-full text-left py-2.5 first:pt-0 last:pb-0 hover:opacity-85 transition-opacity cursor-pointer"
                >
                  <p className="truncate text-sm font-medium text-[#F8FAFC]">
                    {note.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#64748B]">
                    {note.category} · {note.content}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
