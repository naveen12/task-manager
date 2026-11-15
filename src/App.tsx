import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlarmClock,
  Bell,
  CheckSquare,
  FileText,
  LayoutDashboard,
  Settings,
  X,
} from 'lucide-react';
import { AppLogo } from './components/AppLogo';
import {
  DEFAULT_SETTINGS,
  doesReminderOccurOnDate,
  formatDateToYMD,
  getInitialNotes,
  getInitialReminders,
  getInitialTasks,
  getTodayDateString,
  INITIAL_ALARMS,
  type AppFontFamily,
  type AppSettings,
  type ChronoAlarm,
  type NavTab,
  type NoteItem,
  type PriorityLevel,
  type ReminderItem,
  type TaskItem,
} from './types/chrono';
import { DashboardSection, type QuickAddTarget } from './components/DashboardSection';
import { TasksSection } from './components/TasksSection';
import { RemindersSection } from './components/RemindersSection';
import { AlarmsSection } from './components/AlarmsSection';
import { NotesSection } from './components/NotesSection';
import { SettingsSection } from './components/SettingsSection';
import { AlarmRingOverlay } from './components/AlarmRingOverlay';
import { soundEngine } from './utils/soundEngine';
import {
  closeSystemAlertNotification,
  getNotificationPermissionState,
  registerNotificationServiceWorker,
  requestOSNotificationPermission,
  showSystemAlertNotification,
  startAlertVibration,
  stopAlertVibration,
  type ActiveAlert,
  type NotificationPermissionState,
} from './utils/notificationEngine';
import {
  computeUpcomingNativeAlerts,
  getAndroidAlertPermissions,
  notifyNativeServiceAction,
  syncNativeAndroidAlerts,
  triggerAndroidPermissionSetting,
  type AndroidAlertPermissionsStatus,
  type AndroidPermissionAction,
} from './utils/nativeAndroidBridge';
import { initAuth } from './utils/googleAuth';
import type { ChronoBackupPayload } from './utils/googleDriveBackup';

const STORAGE_KEYS = {
  tasks: 'chrono_tempo_tasks_v2',
  reminders: 'chrono_tempo_reminders_v2',
  alarms: 'chrono_tempo_alarms_v2',
  notes: 'chrono_tempo_notes_v2',
  settings: 'chrono_tempo_settings_v1',
  snoozed: 'kairo_snoozed_alerts_v1',
};

interface SnoozedAlertEntry {
  alert: ActiveAlert;
  triggerAtMs: number;
}

function format12HourTime(hour24: number, minute: number): string {
  const h12 = hour24 % 12 || 12;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  return `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

function parseHHMM(hhmm: string): { hour24: number; minute: number } | null {
  const parts = hhmm.split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return null;
  }
  return { hour24: parts[0], minute: parts[1] };
}

const FONT_STACKS: Record<AppFontFamily, { display: string; sans: string }> = {
  jakarta: {
    display: '"Plus Jakarta Sans", system-ui, sans-serif',
    sans: '"DM Sans", system-ui, sans-serif',
  },
  manrope: {
    display: '"Manrope", system-ui, sans-serif',
    sans: '"Manrope", system-ui, sans-serif',
  },
  outfit: {
    display: '"Outfit", system-ui, sans-serif',
    sans: '"Outfit", system-ui, sans-serif',
  },
  lora: {
    display: '"Lora", Georgia, serif',
    sans: '"Lora", Georgia, serif',
  },
  mono: {
    display: '"JetBrains Mono", ui-monospace, monospace',
    sans: '"JetBrains Mono", ui-monospace, monospace',
  },
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

function normalizePriority(p?: string): PriorityLevel {
  if (p === 'high' || p === 'medium' || p === 'low') return p;
  return 'medium';
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [now, setNow] = useState<Date>(() => new Date());

  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...loadStored(STORAGE_KEYS.settings, () => DEFAULT_SETTINGS),
  }));

  const [tasks, setTasks] = useState<TaskItem[]>(() =>
    loadStored(STORAGE_KEYS.tasks, getInitialTasks).map((t) => ({
      ...t,
      priority: normalizePriority(t.priority),
    }))
  );
  const [reminders, setReminders] = useState<ReminderItem[]>(() =>
    loadStored(STORAGE_KEYS.reminders, getInitialReminders).map((r) => ({
      ...r,
      priority: normalizePriority(r.priority),
    }))
  );
  const [alarms, setAlarms] = useState<ChronoAlarm[]>(() =>
    loadStored(STORAGE_KEYS.alarms, () => INITIAL_ALARMS)
  );
  const [notes, setNotes] = useState<NoteItem[]>(() =>
    loadStored(STORAGE_KEYS.notes, getInitialNotes)
  );

  // Trigger counters for Dashboard '+' Quick Add actions
  const [quickAddDate, setQuickAddDate] = useState<string | undefined>(undefined);
  const [createTriggers, setCreateTriggers] = useState<Record<QuickAddTarget, number>>({
    tasks: 0,
    reminders: 0,
    alarms: 0,
    notes: 0,
  });

  const [alertQueue, setAlertQueue] = useState<ActiveAlert[]>([]);
  const [snoozedAlerts, setSnoozedAlerts] = useState<SnoozedAlertEntry[]>(() =>
    loadStored<SnoozedAlertEntry[]>(STORAGE_KEYS.snoozed, () => [])
  );
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>(() => getNotificationPermissionState());
  const [notifBannerDismissed, setNotifBannerDismissed] = useState<boolean>(false);
  const [androidPermissions, setAndroidPermissions] =
    useState<AndroidAlertPermissionsStatus>({
      isNativeAndroid: false,
      postNotifications: false,
      exactAlarms: false,
      fullScreenIntent: false,
      overlayPermission: false,
      batteryOptimizationIgnored: false,
    });

  const sessionStartMsRef = useRef<number>(Date.now());
  const firedKeysRef = useRef<Set<string>>(new Set());

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

  // Apply theme, font size, and font family to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.fontSize = `${settings.fontSizePx}px`;
    const stack = FONT_STACKS[settings.fontFamily] ?? FONT_STACKS.jakarta;
    root.style.setProperty('--ct-font-display', stack.display);
    root.style.setProperty('--ct-font-sans', stack.sans);

    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings]);

  // Persist all 4 data modules to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
    } catch {
      // Ignore
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.snoozed, JSON.stringify(snoozedAlerts));
    } catch {
      // Ignore
    }
  }, [snoozedAlerts]);

  // Register Service Worker for interactive OS notifications
  useEffect(() => {
    if (notificationPermission === 'granted') {
      void registerNotificationServiceWorker();
    }
  }, [notificationPermission]);

  const activeAlert = alertQueue[0] ?? null;

  // Keep sound loop + vibration synced with the frontmost active alert
  useEffect(() => {
    if (!activeAlert) {
      soundEngine.stopAlarmLoop();
      stopAlertVibration();
      return;
    }
    soundEngine.startAlarmLoop(activeAlert.tone, activeAlert.customRingtoneId);
    startAlertVibration();
  }, [activeAlert?.uid]);

  const enqueueAlerts = useCallback((incoming: ActiveAlert[]) => {
    if (incoming.length === 0) return;
    setAlertQueue((prev) => {
      const existingUids = new Set(prev.map((a) => a.uid));
      const fresh = incoming.filter((a) => !existingUids.has(a.uid));
      if (fresh.length === 0) return prev;
      fresh.forEach((a) => {
        void showSystemAlertNotification(a);
      });
      return [...prev, ...fresh];
    });
  }, []);

  // Sync upcoming Alarms, Reminders, Tasks, and Snoozes to Native Android AlarmManager
  useEffect(() => {
    const upcoming = computeUpcomingNativeAlerts(
      alarms,
      reminders,
      tasks,
      snoozedAlerts
    );
    void syncNativeAndroidAlerts(upcoming);
  }, [alarms, reminders, tasks, snoozedAlerts]);

  // Unlock Web Audio on first user interaction & refresh native Android permission status on resume
  useEffect(() => {
    const unlock = () => soundEngine.unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    const refreshNativePerms = () => {
      void getAndroidAlertPermissions().then(setAndroidPermissions);
    };
    refreshNativePerms();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshNativePerms();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refreshNativePerms);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refreshNativePerms);
    };
  }, []);

  // Real-time 1s clock + Task, Reminder, Alarm & Snooze trigger check (with lock/sleep catch-up)
  const evaluateDueAlerts = useCallback(() => {
    const current = new Date();
    const nowMs = current.getTime();
    setNow(current);

    const todayStr = formatDateToYMD(current);
    const currentDay = current.getDay();
    const dueAlerts: ActiveAlert[] = [];

    const isDueInWindow = (hour24: number, minute: number, key: string): boolean => {
      if (firedKeysRef.current.has(key)) return false;
      const scheduled = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate(),
        hour24,
        minute,
        0,
        0
      ).getTime();
      if (
        nowMs >= scheduled &&
        nowMs - scheduled <= 60 * 60 * 1000 &&
        scheduled >= sessionStartMsRef.current - 60 * 1000
      ) {
        firedKeysRef.current.add(key);
        return true;
      }
      return false;
    };

    // 1. Alarms
    alarms.forEach((a) => {
      if (!a.enabled) return;
      if (a.days.length > 0 && !a.days.includes(currentDay)) return;
      const key = `alarm:${a.id}:${todayStr}:${a.hour24}:${a.minute}`;
      if (isDueInWindow(a.hour24, a.minute, key)) {
        dueAlerts.push({
          uid: key,
          sourceId: a.id,
          type: 'alarm',
          name: a.label || 'Kairo Alarm',
          timeLabel: format12HourTime(a.hour24, a.minute),
          tone: a.tone,
          customRingtoneId: a.customRingtoneId,
        });
      }
    });

    // 2. Reminders
    reminders.forEach((r) => {
      if (!r.active || r.completed) return;
      if (!doesReminderOccurOnDate(r, todayStr)) return;
      const parsed = parseHHMM(r.time);
      if (!parsed) return;
      const key = `reminder:${r.id}:${todayStr}:${r.time}`;
      if (isDueInWindow(parsed.hour24, parsed.minute, key)) {
        dueAlerts.push({
          uid: key,
          sourceId: r.id,
          type: 'reminder',
          name: r.title,
          timeLabel: format12HourTime(parsed.hour24, parsed.minute),
          tone: 'zenith',
        });
      }
    });

    // 3. Tasks
    tasks.forEach((t) => {
      if (t.completed || t.dueDate !== todayStr) return;
      const parsed = parseHHMM(t.dueTime);
      if (!parsed) return;
      const key = `task:${t.id}:${todayStr}:${t.dueTime}`;
      if (isDueInWindow(parsed.hour24, parsed.minute, key)) {
        dueAlerts.push({
          uid: key,
          sourceId: t.id,
          type: 'task',
          name: t.title,
          timeLabel: format12HourTime(parsed.hour24, parsed.minute),
          tone: 'dawn',
        });
      }
    });

    // 4. Snoozed Alerts (for Alarms, Reminders, and Tasks)
    const dueSnoozes = snoozedAlerts.filter((entry) => nowMs >= entry.triggerAtMs);
    if (dueSnoozes.length > 0) {
      setSnoozedAlerts((prev) => prev.filter((entry) => nowMs < entry.triggerAtMs));
      dueSnoozes.forEach((entry) => {
        const d = new Date(entry.triggerAtMs);
        dueAlerts.push({
          ...entry.alert,
          uid: `${entry.alert.sourceId}-snooze-${entry.triggerAtMs}`,
          timeLabel: format12HourTime(d.getHours(), d.getMinutes()),
        });
      });
    }

    if (dueAlerts.length > 0) {
      enqueueAlerts(dueAlerts);
    }
  }, [alarms, reminders, tasks, snoozedAlerts, enqueueAlerts]);

  useEffect(() => {
    const id = window.setInterval(evaluateDueAlerts, 1000);
    const onWake = () => {
      if (document.visibilityState === 'visible') {
        evaluateDueAlerts();
      }
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [evaluateDueAlerts]);

  // Quick Add handler from Dashboard '+' button
  const handleQuickAdd = useCallback(
    (target: QuickAddTarget, defaultDate?: string) => {
      soundEngine.playTick(880, 0.025);
      setQuickAddDate(defaultDate);
      setActiveTab(target);
      setCreateTriggers((prev) => ({ ...prev, [target]: prev[target] + 1 }));
    },
    []
  );

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

  const handleTriggerTestRing = useCallback(
    (alarm: ChronoAlarm) => {
      enqueueAlerts([
        {
          uid: `test-${alarm.id}-${Date.now()}`,
          sourceId: alarm.id,
          type: 'alarm',
          name: alarm.label || 'Kairo Alarm',
          timeLabel: format12HourTime(alarm.hour24, alarm.minute),
          tone: alarm.tone,
          customRingtoneId: alarm.customRingtoneId,
        },
      ]);
    },
    [enqueueAlerts]
  );

  const handleStopAlert = useCallback(
    (targetUid?: string) => {
      const target = targetUid
        ? alertQueue.find((a) => a.uid === targetUid)
        : alertQueue[0];
      void notifyNativeServiceAction('stop');
      if (target) {
        void closeSystemAlertNotification(target.uid);
        setAlertQueue((prev) => prev.filter((a) => a.uid !== target.uid));
      } else {
        soundEngine.stopAlarmLoop();
        stopAlertVibration();
      }
    },
    [alertQueue]
  );

  const handleSnoozeAlert = useCallback(
    (targetUid?: string) => {
      const target = targetUid
        ? alertQueue.find((a) => a.uid === targetUid)
        : alertQueue[0];
      if (!target) return;

      void notifyNativeServiceAction('snooze');
      void closeSystemAlertNotification(target.uid);
      const triggerAtMs = Date.now() + 5 * 60 * 1000;
      const snoozeDate = new Date(triggerAtMs);
      setSnoozedAlerts((prev) => [
        ...prev,
        {
          alert: {
            ...target,
            timeLabel: format12HourTime(
              snoozeDate.getHours(),
              snoozeDate.getMinutes()
            ),
          },
          triggerAtMs,
        },
      ]);
      setAlertQueue((prev) => prev.filter((a) => a.uid !== target.uid));
    },
    [alertQueue]
  );

  // Listen to Service Worker notification Snooze/Stop action button clicks
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    const handleMessage = (event: MessageEvent) => {
      const payload = event.data as
        | { type?: string; action?: string; uid?: string }
        | undefined;
      if (!payload || payload.type !== 'KAIRO_NOTIFICATION_ACTION') return;
      if (payload.action === 'snooze') {
        handleSnoozeAlert(payload.uid);
      } else if (payload.action === 'stop') {
        handleStopAlert(payload.uid);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [handleSnoozeAlert, handleStopAlert]);

  const handleRequestNotificationPermission = useCallback(async () => {
    soundEngine.playTick(860, 0.02);
    const next = await requestOSNotificationPermission();
    setNotificationPermission(next);
  }, []);

  const handleTestAlertPopup = useCallback(() => {
    const d = new Date();
    enqueueAlerts([
      {
        uid: `test-alert-${Date.now()}`,
        sourceId: 'test-reminder',
        type: 'reminder',
        name: 'Sample Alert · Tap Snooze or Stop',
        timeLabel: format12HourTime(d.getHours(), d.getMinutes()),
        tone: 'amber',
      },
    ]);
  }, [enqueueAlerts]);

  const handleTriggerAndroidPermission = useCallback(
    async (kind: AndroidPermissionAction) => {
      soundEngine.playTick(860, 0.02);
      await triggerAndroidPermissionSetting(kind);
      const refreshed = await getAndroidAlertPermissions();
      setAndroidPermissions(refreshed);
    },
    []
  );

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
    setTasks(
      payload.data.tasks.map((t) => ({
        ...t,
        priority: normalizePriority(t.priority),
      }))
    );
    setReminders(
      payload.data.reminders.map((r) => ({
        ...r,
        priority: normalizePriority(r.priority),
      }))
    );
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
    { id: 'settings' as NavTab, label: 'Settings', mobileLabel: 'Settings', icon: Settings },
  ];

  const today = getTodayDateString();
  const todayTasksRemaining = tasks.filter(
    (t) => t.dueDate === today && !t.completed
  ).length;

  return (
    <div className="min-h-screen bg-[#F4F6FB] dark:bg-[#090A0F] text-slate-900 dark:text-[#F8FAFC] flex flex-col lg:flex-row transition-colors duration-200">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-[272px] lg:shrink-0 lg:flex-col lg:justify-between bg-white dark:bg-[#12141F] border-r border-slate-200 dark:border-white/[0.08] p-6 sticky top-0 h-screen overflow-y-auto">
        <div>
          {/* Wordmark */}
          <div className="flex items-center gap-3">
            <AppLogo className="h-9 w-9" />
            <span className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC]">
              Kairo
            </span>
          </div>

          {/* Live Clock */}
          <div className="mt-7 pb-5 border-b border-slate-200 dark:border-white/[0.06]">
            <p className="text-xs font-medium text-slate-500 dark:text-[#94A3B8]">
              {clockDisplay.dateLabel}
            </p>
            <div className="mt-2 flex items-baseline gap-1.5 font-mono tabular-nums">
              <span className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-[#F8FAFC]">
                {clockDisplay.hm}
              </span>
              <span className="text-sm font-medium text-slate-400 dark:text-[#64748B]">
                :{clockDisplay.sec}
              </span>
              <span className="ml-1 text-xs font-semibold text-indigo-600 dark:text-[#818CF8]">
                {clockDisplay.period}
              </span>
            </div>
          </div>

          {/* Clear Navigation */}
          <nav aria-label="Primary sections" className="mt-5 flex flex-col gap-1">
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
                  className={`flex min-h-[44px] items-center gap-3 rounded-2xl px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-[#1A1D2D] text-indigo-700 dark:text-[#F8FAFC] border border-indigo-200 dark:border-white/12 shadow-xs dark:shadow-[0_0_20px_rgba(99,102,241,0.12)]'
                      : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-white/[0.03] border border-transparent'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive
                        ? 'text-indigo-600 dark:text-[#818CF8]'
                        : 'text-slate-400 dark:text-[#64748B]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quiet Temporal Summary */}
        <div className="pt-5 mt-4 border-t border-slate-200 dark:border-white/[0.06] flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-[#64748B]">Next alarm</span>
            <span className="font-mono font-medium text-amber-600 dark:text-[#F59E0B] tabular-nums">
              {nextAlarmLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-[#64748B]">Tasks due today</span>
            <span className="font-mono font-medium text-emerald-600 dark:text-[#34D399] tabular-nums">
              {todayTasksRemaining} left
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Compact Header with OS Status Bar Safe Area */}
      <header className="lg:hidden sticky top-0 z-30 bg-[#F4F6FB]/92 dark:bg-[#090A0F]/92 backdrop-blur-xl border-b border-slate-200 dark:border-white/[0.06] px-4 safe-top-header flex items-center justify-between gap-2 min-h-[60px]">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <AppLogo className="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-semibold leading-snug text-slate-900 dark:text-[#F8FAFC] truncate">
              {activeTab === 'dashboard'
                ? 'Kairo'
                : (desktopNavItems.find((n) => n.id === activeTab)?.label ?? 'Kairo')}
            </h1>
            <p className="text-[11px] leading-snug text-slate-500 dark:text-[#94A3B8] truncate">
              {clockDisplay.dateLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="text-right font-mono tabular-nums mr-1">
            <div className="text-sm font-semibold text-slate-900 dark:text-[#F8FAFC] leading-snug">
              {clockDisplay.hm}{' '}
              <span className="text-[11px] text-indigo-600 dark:text-[#818CF8]">
                {clockDisplay.period}
              </span>
            </div>
            <div className="text-[10px] leading-snug text-amber-600 dark:text-[#F59E0B]">
              {nextAlarmLabel}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playTick(820, 0.02);
              setActiveTab('settings');
            }}
            aria-label="Settings"
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-indigo-50 dark:bg-[#6366F1]/25 border-indigo-300 dark:border-[#6366F1]/50 text-indigo-700 dark:text-[#c0c1ff]'
                : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-600 dark:text-[#94A3B8]'
            }`}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 pt-5 pb-32 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          {/* Desktop Page Header */}
          <div className="hidden lg:flex items-end justify-between mb-8">
            <div>
              <p className="text-xs font-medium text-indigo-600 dark:text-[#818CF8]">
                {clockDisplay.greeting}
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC] text-balance">
                {activeTab === 'dashboard' && 'Daily Overview'}
                {activeTab === 'tasks' && 'Tasks'}
                {activeTab === 'reminders' && 'Reminders'}
                {activeTab === 'alarms' && 'Alarms'}
                {activeTab === 'notes' && 'Notes'}
                {activeTab === 'settings' && 'Settings'}
              </h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-[#94A3B8] tabular-nums">
              {clockDisplay.dateLabel} · {todayTasksRemaining} tasks remaining today
            </p>
          </div>

          {/* One-tap Notification Permission Prompt (when not yet granted) */}
          {notificationPermission === 'default' && !notifBannerDismissed && (
            <div
              role="region"
              aria-label="Enable notifications"
              className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-indigo-50 dark:bg-[#6366F1]/12 border border-indigo-200 dark:border-[#6366F1]/35 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Bell className="h-4 w-4 text-indigo-600 dark:text-[#818CF8] shrink-0" />
                <p className="text-xs sm:text-sm text-slate-800 dark:text-[#F8FAFC]">
                  Enable notifications so Tasks, Reminders, and Alarms alert you with Snooze &amp; Stop controls.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleRequestNotificationPermission()}
                  className="h-9 rounded-full bg-gradient-to-r from-[#6366F1] to-[#818CF8] px-4 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                >
                  Enable Alerts
                </button>
                <button
                  type="button"
                  onClick={() => setNotifBannerDismissed(true)}
                  aria-label="Dismiss notification prompt"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] cursor-pointer"
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
              onQuickAdd={handleQuickAdd}
              onToggleTask={handleToggleTask}
              onToggleReminderDone={handleToggleReminderDone}
              onToggleAlarm={handleToggleAlarm}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksSection
              tasks={tasks}
              autoOpenCreateKey={createTriggers.tasks}
              defaultCreateDate={quickAddDate}
              onToggleTask={handleToggleTask}
              onCreateTask={handleCreateTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {activeTab === 'reminders' && (
            <RemindersSection
              reminders={reminders}
              autoOpenCreateKey={createTriggers.reminders}
              defaultCreateDate={quickAddDate}
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
              autoOpenCreateKey={createTriggers.alarms}
              onToggleAlarm={handleToggleAlarm}
              onSaveAlarm={handleSaveAlarm}
              onDeleteAlarm={handleDeleteAlarm}
              onTriggerTestRing={handleTriggerTestRing}
            />
          )}

          {activeTab === 'notes' && (
            <NotesSection
              notes={notes}
              autoOpenCreateKey={createTriggers.notes}
              onCreateNote={handleCreateNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onTogglePin={handleToggleNotePin}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsSection
              settings={settings}
              onUpdateSettings={setSettings}
              googleUser={googleUser}
              needsGoogleAuth={needsGoogleAuth}
              onAuthUpdated={(user, needs) => {
                setGoogleUser(user);
                setNeedsGoogleAuth(needs);
              }}
              tasks={tasks}
              reminders={reminders}
              alarms={alarms}
              notes={notes}
              onRestoreBackup={handleRestoreBackup}
              notificationPermission={notificationPermission}
              onRequestNotificationPermission={() => {
                void handleRequestNotificationPermission();
              }}
              onTestAlertPopup={handleTestAlertPopup}
              androidPermissions={androidPermissions}
              onTriggerAndroidPermission={(kind) => {
                void handleTriggerAndroidPermission(kind);
              }}
            />
          )}
        </div>
      </main>

      {/* Mobile Fixed Bottom Thumb Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/94 dark:bg-[#12141F]/92 backdrop-blur-xl border-t border-slate-200 dark:border-white/[0.08] px-1 pt-1.5 safe-bottom-nav"
      >
        <div className="grid grid-cols-5 min-h-[58px] items-center">
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
                className="flex min-h-[48px] flex-col items-center justify-center gap-1 px-1 py-1 cursor-pointer"
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition-colors ${
                    isActive
                      ? 'text-indigo-600 dark:text-[#818CF8]'
                      : 'text-slate-400 dark:text-[#64748B]'
                  }`}
                />
                <span
                  className={`text-[10px] leading-tight font-medium tracking-tight truncate max-w-full ${
                    isActive
                      ? 'text-slate-900 dark:text-[#F8FAFC]'
                      : 'text-slate-500 dark:text-[#94A3B8]'
                  }`}
                >
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Minimal Lock-Screen Ready Alert Popup (Task, Reminder, Alarm) */}
      <AlarmRingOverlay
        alert={activeAlert}
        queueCount={alertQueue.length}
        onSnooze={() => handleSnoozeAlert()}
        onStop={() => handleStopAlert()}
      />
    </div>
  );
}
