import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlarmClock,
  Bell,
  CheckSquare,
  Cloud,
  FileText,
  LayoutDashboard,
  Timer,
  X,
} from 'lucide-react';
import {
  getInitialNotes,
  getInitialReminders,
  getInitialTasks,
  getTodayDateString,
  INITIAL_ALARMS,
  type ChronoAlarm,
  type NavTab,
  type NoteItem,
  type ReminderItem,
  type TaskItem,
} from './types/chrono';
import { DashboardSection } from './components/DashboardSection';
import { TasksSection } from './components/TasksSection';
import { RemindersSection } from './components/RemindersSection';
import { AlarmsSection } from './components/AlarmsSection';
import { NotesSection } from './components/NotesSection';
import { BackupSection } from './components/BackupSection';
import { AlarmRingOverlay } from './components/AlarmRingOverlay';
import { soundEngine } from './utils/soundEngine';
import { initAuth } from './utils/googleAuth';
import type { ChronoBackupPayload } from './utils/googleDriveBackup';

const STORAGE_KEYS = {
  tasks: 'chrono_tempo_tasks_v2',
  reminders: 'chrono_tempo_reminders_v2',
  alarms: 'chrono_tempo_alarms_v2',
  notes: 'chrono_tempo_notes_v2',
};

function loadStored<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback();
    return JSON.parse(raw) as T;
  } catch {
    return fallback();
  }
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [now, setNow] = useState<Date>(() => new Date());

  const [tasks, setTasks] = useState<TaskItem[]>(() =>
    loadStored(STORAGE_KEYS.tasks, getInitialTasks)
  );
  const [reminders, setReminders] = useState<ReminderItem[]>(() =>
    loadStored(STORAGE_KEYS.reminders, getInitialReminders)
  );
  const [alarms, setAlarms] = useState<ChronoAlarm[]>(() =>
    loadStored(STORAGE_KEYS.alarms, () => INITIAL_ALARMS)
  );
  const [notes, setNotes] = useState<NoteItem[]>(() =>
    loadStored(STORAGE_KEYS.notes, getInitialNotes)
  );

  const [ringingAlarm, setRingingAlarm] = useState<ChronoAlarm | null>(null);
  const [dueReminderAlert, setDueReminderAlert] = useState<ReminderItem | null>(
    null
  );
  const lastTriggeredMinuteRef = useRef<string>('');

  // Google Account auth state (token cached strictly in memory)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
        setNeedsGoogleAuth(false);
      },
      (user) => {
        setGoogleUser(user);
        setNeedsGoogleAuth(true);
      }
    );
    return unsubscribe;
  }, []);

  // Persist all 4 modules to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
    } catch {
      // Ignore storage errors
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.reminders, JSON.stringify(reminders));
    } catch {
      // Ignore
    }
  }, [reminders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.alarms, JSON.stringify(alarms));
    } catch {
      // Ignore
    }
  }, [alarms]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
    } catch {
      // Ignore
    }
  }, [notes]);

  // Real-time 1s clock + automatic Alarm & Reminder trigger check
  useEffect(() => {
    const id = window.setInterval(() => {
      const current = new Date();
      setNow(current);

      const minuteKey = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}-${current.getHours()}:${current.getMinutes()}`;
      if (lastTriggeredMinuteRef.current !== minuteKey) {
        lastTriggeredMinuteRef.current = minuteKey;

        const currentHour = current.getHours();
        const currentMin = current.getMinutes();
        const currentDay = current.getDay();
        const currentHHMM = `${String(currentHour).padStart(2, '0')}:${String(
          currentMin
        ).padStart(2, '0')}`;
        const todayStr = getTodayDateString();

        const matchingAlarm = alarms.find(
          (a) =>
            a.enabled &&
            a.hour24 === currentHour &&
            a.minute === currentMin &&
            (a.days.length === 0 || a.days.includes(currentDay))
        );
        if (matchingAlarm) {
          setRingingAlarm(matchingAlarm);
          soundEngine.startAlarmLoop(matchingAlarm.tone);
        }

        const matchingReminder = reminders.find(
          (r) =>
            r.active &&
            !r.completed &&
            r.time === currentHHMM &&
            (r.date === todayStr ||
              r.repeat === 'daily' ||
              (r.repeat === 'weekdays' && currentDay >= 1 && currentDay <= 5))
        );
        if (matchingReminder) {
          setDueReminderAlert(matchingReminder);
          soundEngine.playCompletionChime();
        }
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [alarms, reminders]);

  // Task CRUD handlers
  const handleToggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }, []);

  const handleCreateTask = useCallback(
    (data: Omit<TaskItem, 'id' | 'completed'>) => {
      setTasks((prev) => [
        ...prev,
        { ...data, id: `task-${Date.now()}`, completed: false },
      ]);
    },
    []
  );

  const handleUpdateTask = useCallback(
    (id: string, updates: Omit<TaskItem, 'id'>) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...updates, id } : t))
      );
    },
    []
  );

  const handleDeleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Reminder CRUD handlers
  const handleCreateReminder = useCallback(
    (data: Omit<ReminderItem, 'id' | 'completed'>) => {
      setReminders((prev) => [
        ...prev,
        { ...data, id: `rem-${Date.now()}`, completed: false },
      ]);
    },
    []
  );

  const handleUpdateReminder = useCallback(
    (id: string, updates: Omit<ReminderItem, 'id'>) => {
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...updates, id } : r))
      );
    },
    []
  );

  const handleDeleteReminder = useCallback((id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleToggleReminderActive = useCallback((id: string, active: boolean) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active } : r))
    );
  }, []);

  const handleToggleReminderDone = useCallback((id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r))
    );
  }, []);

  // Alarm CRUD handlers
  const handleToggleAlarm = useCallback((id: string, enabled: boolean) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled } : a))
    );
  }, []);

  const handleSaveAlarm = useCallback(
    (data: Omit<ChronoAlarm, 'id'>, existingId?: string) => {
      if (existingId) {
        setAlarms((prev) =>
          prev.map((a) => (a.id === existingId ? { ...data, id: existingId } : a))
        );
      } else {
        setAlarms((prev) => [...prev, { ...data, id: `alarm-${Date.now()}` }]);
      }
    },
    []
  );

  const handleDeleteAlarm = useCallback((id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleTriggerTestRing = useCallback((alarm: ChronoAlarm) => {
    setRingingAlarm(alarm);
    soundEngine.startAlarmLoop(alarm.tone);
  }, []);

  const handleDismissAlarm = useCallback(() => {
    soundEngine.stopAlarmLoop();
    setRingingAlarm(null);
  }, []);

  const handleSnoozeAlarm = useCallback(() => {
    soundEngine.stopAlarmLoop();
    if (ringingAlarm) {
      const snoozeDate = new Date(Date.now() + 5 * 60 * 1000);
      setAlarms((prev) => [
        ...prev,
        {
          id: `snooze-${Date.now()}`,
          hour24: snoozeDate.getHours(),
          minute: snoozeDate.getMinutes(),
          label: `${ringingAlarm.label} (Snoozed)`,
          enabled: true,
          days: [],
          tone: ringingAlarm.tone,
        },
      ]);
    }
    setRingingAlarm(null);
  }, [ringingAlarm]);

  // Note CRUD handlers
  const handleCreateNote = useCallback(
    (data: Omit<NoteItem, 'id' | 'updatedAt'>) => {
      setNotes((prev) => [
        {
          ...data,
          id: `note-${Date.now()}`,
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    []
  );

  const handleUpdateNote = useCallback(
    (id: string, updates: Omit<NoteItem, 'id' | 'updatedAt'>) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...updates, id, updatedAt: new Date().toISOString() }
            : n
        )
      );
    },
    []
  );

  const handleDeleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleToggleNotePin = useCallback((id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n))
    );
  }, []);

  const handleRestoreBackup = useCallback((payload: ChronoBackupPayload) => {
    setTasks(payload.data.tasks);
    setReminders(payload.data.reminders);
    setAlarms(payload.data.alarms);
    setNotes(payload.data.notes);
  }, []);

  // Derived clock & summary
  const clockDisplay = useMemo(() => {
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const h12 = h % 12 || 12;
    const period = h >= 12 ? 'PM' : 'AM';
    return {
      hm: `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      sec: String(s).padStart(2, '0'),
      period,
      dateLabel: now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
      greeting: getGreeting(h),
    };
  }, [now]);

  const nextAlarmLabel = useMemo(() => {
    const active = alarms.filter((a) => a.enabled);
    if (active.length === 0) return 'Off';
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const sorted = [...active].sort((a, b) => {
      const aMin = a.hour24 * 60 + a.minute;
      const bMin = b.hour24 * 60 + b.minute;
      const aDelta = aMin > nowMinutes ? aMin - nowMinutes : aMin + 1440 - nowMinutes;
      const bDelta = bMin > nowMinutes ? bMin - nowMinutes : bMin + 1440 - nowMinutes;
      return aDelta - bDelta;
    });
    const next = sorted[0];
    const h12 = next.hour24 % 12 || 12;
    const period = next.hour24 >= 12 ? 'PM' : 'AM';
    return `${String(h12).padStart(2, '0')}:${String(next.minute).padStart(
      2,
      '0'
    )} ${period}`;
  }, [alarms, now]);

  const primaryNavItems: {
    id: NavTab;
    label: string;
    mobileLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Today', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks', mobileLabel: 'Tasks', icon: CheckSquare },
    { id: 'reminders', label: 'Reminders', mobileLabel: 'Reminders', icon: Bell },
    { id: 'alarms', label: 'Alarms', mobileLabel: 'Alarms', icon: AlarmClock },
    { id: 'notes', label: 'Notes', mobileLabel: 'Notes', icon: FileText },
  ];

  const desktopNavItems = [
    ...primaryNavItems,
    { id: 'backup' as NavTab, label: 'Google Backup', mobileLabel: 'Backup', icon: Cloud },
  ];

  const today = getTodayDateString();
  const todayTasksRemaining = tasks.filter(
    (t) => t.dueDate === today && !t.completed
  ).length;

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-[272px] lg:shrink-0 lg:flex-col lg:justify-between bg-[#12141F] border-r border-white/[0.08] p-6 sticky top-0 h-screen">
        <div>
          {/* Wordmark */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#818CF8] shadow-[0_0_20px_rgba(99,102,241,0.45)]">
              <Timer className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-[#F8FAFC]">
              Chrono Tempo
            </span>
          </div>

          {/* Live Clock */}
          <div className="mt-8 pb-6 border-b border-white/[0.06]">
            <p className="text-xs font-medium text-[#94A3B8]">
              {clockDisplay.dateLabel}
            </p>
            <div className="mt-2 flex items-baseline gap-1.5 font-mono tabular-nums">
              <span className="text-4xl font-semibold tracking-tight text-[#F8FAFC]">
                {clockDisplay.hm}
              </span>
              <span className="text-sm font-medium text-[#64748B]">
                :{clockDisplay.sec}
              </span>
              <span className="ml-1 text-xs font-semibold text-[#818CF8]">
                {clockDisplay.period}
              </span>
            </div>
          </div>

          {/* Clear Navigation */}
          <nav aria-label="Primary sections" className="mt-6 flex flex-col gap-1.5">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playTick(820, 0.02);
                    setActiveTab(item.id);
                  }}
                  className={`flex h-12 items-center gap-3 rounded-2xl px-4 text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#1A1D2D] text-[#F8FAFC] border border-white/12 shadow-[0_0_20px_rgba(99,102,241,0.12)]'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.03] border border-transparent'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? 'text-[#818CF8]' : 'text-[#64748B]'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quiet Temporal & Google Backup Summary */}
        <div className="pt-5 border-t border-white/[0.06] flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#64748B]">Next alarm</span>
            <span className="font-mono font-medium text-[#F59E0B] tabular-nums">
              {nextAlarmLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#64748B]">Tasks due today</span>
            <span className="font-mono font-medium text-[#34D399] tabular-nums">
              {todayTasksRemaining} left
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className="mt-1 flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <span className="text-[#94A3B8] truncate">
              {needsGoogleAuth ? 'Google Drive Backup' : googleUser?.email ?? 'Drive Connected'}
            </span>
            <span
              className={`shrink-0 font-medium ${
                needsGoogleAuth ? 'text-[#818CF8]' : 'text-[#34D399]'
              }`}
            >
              {needsGoogleAuth ? 'Connect' : 'Synced'}
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile Compact Header */}
      <header className="lg:hidden sticky top-0 z-30 bg-[#090A0F]/85 backdrop-blur-xl border-b border-white/[0.06] px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366F1] to-[#818CF8]">
            <Timer className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-base font-semibold leading-tight text-[#F8FAFC] truncate">
              {desktopNavItems.find((n) => n.id === activeTab)?.label ?? 'Dashboard'}
            </h1>
            <p className="text-[11px] text-[#94A3B8] truncate">{clockDisplay.dateLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right font-mono tabular-nums">
            <div className="text-sm font-semibold text-[#F8FAFC] leading-tight">
              {clockDisplay.hm}{' '}
              <span className="text-[11px] text-[#818CF8]">{clockDisplay.period}</span>
            </div>
            <div className="text-[10px] text-[#F59E0B]">Alarm · {nextAlarmLabel}</div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playTick(820, 0.02);
              setActiveTab('backup');
            }}
            aria-label="Google Drive Backup"
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-[#6366F1]/25 border-[#6366F1]/50 text-[#c0c1ff]'
                : needsGoogleAuth
                  ? 'bg-white/[0.04] border-white/10 text-[#94A3B8]'
                  : 'bg-[#10B981]/15 border-[#10B981]/40 text-[#34D399]'
            }`}
          >
            <Cloud className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 min-w-0 px-5 pt-6 pb-28 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          {/* Desktop Page Header */}
          <div className="hidden lg:flex items-end justify-between mb-8">
            <div>
              <p className="text-xs font-medium text-[#818CF8]">
                {clockDisplay.greeting}
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#F8FAFC] text-balance">
                {activeTab === 'dashboard' && "Today's Activities"}
                {activeTab === 'tasks' && 'Tasks'}
                {activeTab === 'reminders' && 'Reminders'}
                {activeTab === 'alarms' && 'Alarms'}
                {activeTab === 'notes' && 'Notes'}
                {activeTab === 'backup' && 'Google Drive Backup'}
              </h1>
            </div>
            <p className="text-sm text-[#94A3B8] tabular-nums">
              {clockDisplay.dateLabel} · {todayTasksRemaining} tasks remaining today
            </p>
          </div>

          {/* Live Due Reminder Banner */}
          {dueReminderAlert && (
            <div
              role="status"
              className="mb-6 flex items-center justify-between gap-4 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/40 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Bell className="h-4 w-4 text-[#34D399] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#34D399]">
                    Reminder · {dueReminderAlert.time}
                  </p>
                  <p className="truncate text-sm font-medium text-[#F8FAFC]">
                    {dueReminderAlert.title}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleToggleReminderDone(dueReminderAlert.id);
                    setDueReminderAlert(null);
                  }}
                  className="h-9 rounded-full bg-[#10B981] px-3.5 text-xs font-semibold text-[#090A0F] cursor-pointer"
                >
                  Mark Done
                </button>
                <button
                  type="button"
                  onClick={() => setDueReminderAlert(null)}
                  aria-label="Dismiss reminder banner"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Screen Switcher */}
          {activeTab === 'dashboard' && (
            <DashboardSection
              tasks={tasks}
              reminders={reminders}
              alarms={alarms}
              notes={notes}
              onNavigate={setActiveTab}
              onToggleTask={handleToggleTask}
              onToggleReminderDone={handleToggleReminderDone}
              onToggleAlarm={handleToggleAlarm}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksSection
              tasks={tasks}
              onToggleTask={handleToggleTask}
              onCreateTask={handleCreateTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {activeTab === 'reminders' && (
            <RemindersSection
              reminders={reminders}
              onCreateReminder={handleCreateReminder}
              onUpdateReminder={handleUpdateReminder}
              onDeleteReminder={handleDeleteReminder}
              onToggleActive={handleToggleReminderActive}
              onToggleCompleted={handleToggleReminderDone}
            />
          )}

          {activeTab === 'alarms' && (
            <AlarmsSection
              alarms={alarms}
              onToggleAlarm={handleToggleAlarm}
              onSaveAlarm={handleSaveAlarm}
              onDeleteAlarm={handleDeleteAlarm}
              onTriggerTestRing={handleTriggerTestRing}
            />
          )}

          {activeTab === 'notes' && (
            <NotesSection
              notes={notes}
              onCreateNote={handleCreateNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onTogglePin={handleToggleNotePin}
            />
          )}

          {activeTab === 'backup' && (
            <BackupSection
              user={googleUser}
              needsAuth={needsGoogleAuth}
              onAuthUpdated={(user, needs) => {
                setGoogleUser(user);
                setNeedsGoogleAuth(needs);
              }}
              tasks={tasks}
              reminders={reminders}
              alarms={alarms}
              notes={notes}
              onRestoreBackup={handleRestoreBackup}
            />
          )}
        </div>
      </main>

      {/* Mobile Fixed Bottom Thumb Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#12141F]/90 backdrop-blur-xl border-t border-white/[0.08] px-1 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundEngine.playTick(820, 0.02);
                  setActiveTab(item.id);
                }}
                className="flex min-h-[48px] flex-col items-center justify-center gap-1 cursor-pointer"
              >
                <Icon
                  className={`h-5 w-5 transition-colors ${
                    isActive ? 'text-[#818CF8]' : 'text-[#64748B]'
                  }`}
                />
                <span
                  className={`text-[10px] font-medium tracking-tight ${
                    isActive ? 'text-[#F8FAFC]' : 'text-[#94A3B8]'
                  }`}
                >
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Urgent Amber Alarm Trigger Overlay */}
      <AlarmRingOverlay
        alarm={ringingAlarm}
        onSnooze={handleSnoozeAlarm}
        onDismiss={handleDismissAlarm}
      />
    </div>
  );
}
