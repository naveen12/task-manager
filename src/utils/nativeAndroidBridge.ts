import {
  doesReminderOccurOnDate,
  formatDateToYMD,
  parseYMDToLocalDate,
  type ChronoAlarm,
  type ReminderItem,
  type TaskItem,
} from '../types/chrono';
import type { ActiveAlert } from './notificationEngine';

export interface NativeScheduledAlert {
  id: string;
  type: 'alarm' | 'reminder' | 'task' | 'snooze';
  name: string;
  triggerAtMs: number;
  timeLabel: string;
}

export interface AndroidAlertPermissionsStatus {
  isNativeAndroid: boolean;
  postNotifications: boolean;
  exactAlarms: boolean;
  fullScreenIntent: boolean;
  overlayPermission: boolean;
  batteryOptimizationIgnored: boolean;
}

interface KairoAlarmNativePlugin {
  syncAlerts: (opts: { alertsJson: string }) => Promise<{ scheduled: number }>;
  getPermissionStatus: () => Promise<Omit<AndroidAlertPermissionsStatus, 'isNativeAndroid'>>;
  requestNotificationPermission: () => Promise<{ granted: boolean }>;
  openExactAlarmSettings: () => Promise<void>;
  openFullScreenIntentSettings: () => Promise<void>;
  openOverlaySettings: () => Promise<void>;
  openBatterySettings: () => Promise<void>;
  stopActiveAlert: (opts: { action: 'stop' | 'snooze' }) => Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    KairoAlarm?: KairoAlarmNativePlugin;
  };
}

function getCapacitor(): CapacitorGlobal | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNativeAndroidPlatform(): boolean {
  const cap = getCapacitor();
  return Boolean(cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'android');
}

function getKairoAlarmPlugin(): KairoAlarmNativePlugin | null {
  if (!isNativeAndroidPlatform()) return null;
  return getCapacitor()?.Plugins?.KairoAlarm ?? null;
}

function format12Hour(hour24: number, minute: number): string {
  const h12 = hour24 % 12 || 12;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  return `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

export function computeUpcomingNativeAlerts(
  alarms: ChronoAlarm[],
  reminders: ReminderItem[],
  tasks: TaskItem[],
  snoozedAlerts: { alert: ActiveAlert; triggerAtMs: number }[]
): NativeScheduledAlert[] {
  const now = new Date();
  const nowMs = now.getTime();
  const list: NativeScheduledAlert[] = [];

  // 1. Next upcoming occurrence (within 7 days) for each enabled Alarm
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    for (let offset = 0; offset <= 7; offset++) {
      const candidate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + offset,
        alarm.hour24,
        alarm.minute,
        0,
        0
      );
      if (candidate.getTime() <= nowMs + 1000) continue;
      if (alarm.days.length > 0 && !alarm.days.includes(candidate.getDay())) {
        continue;
      }
      list.push({
        id: `alarm-${alarm.id}`,
        type: 'alarm',
        name: alarm.label || 'Kairo Alarm',
        triggerAtMs: candidate.getTime(),
        timeLabel: format12Hour(alarm.hour24, alarm.minute),
      });
      break;
    }
  }

  // 2. Next upcoming occurrence (within 30 days) for each active Reminder
  for (const rem of reminders) {
    if (!rem.active || rem.completed) continue;
    const [hh, mm] = rem.time.split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;

    const maxDays = rem.repeat === 'yearly' ? 366 : 31;
    for (let offset = 0; offset <= maxDays; offset++) {
      const candidate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + offset,
        hh,
        mm,
        0,
        0
      );
      if (candidate.getTime() <= nowMs + 1000) continue;
      const dateStr = formatDateToYMD(candidate);
      if (doesReminderOccurOnDate(rem, dateStr)) {
        list.push({
          id: `rem-${rem.id}`,
          type: 'reminder',
          name: rem.title,
          triggerAtMs: candidate.getTime(),
          timeLabel: format12Hour(hh, mm),
        });
        break;
      }
    }
  }

  // 3. Upcoming uncompleted Tasks
  for (const task of tasks) {
    if (task.completed) continue;
    const [hh, mm] = task.dueTime.split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
    const d = parseYMDToLocalDate(task.dueDate);
    d.setHours(hh, mm, 0, 0);
    if (d.getTime() <= nowMs + 1000) continue;
    list.push({
      id: `task-${task.id}`,
      type: 'task',
      name: task.title,
      triggerAtMs: d.getTime(),
      timeLabel: format12Hour(hh, mm),
    });
  }

  // 4. Active Snoozes
  for (const s of snoozedAlerts) {
    if (s.triggerAtMs <= nowMs + 1000) continue;
    const d = new Date(s.triggerAtMs);
    list.push({
      id: `snooze-${s.alert.sourceId}-${s.triggerAtMs}`,
      type: s.alert.type,
      name: s.alert.name,
      triggerAtMs: s.triggerAtMs,
      timeLabel: format12Hour(d.getHours(), d.getMinutes()),
    });
  }

  return list.sort((a, b) => a.triggerAtMs - b.triggerAtMs).slice(0, 48);
}

export async function syncNativeAndroidAlerts(
  alerts: NativeScheduledAlert[]
): Promise<void> {
  const plugin = getKairoAlarmPlugin();
  if (!plugin) return;
  try {
    await plugin.syncAlerts({ alertsJson: JSON.stringify(alerts) });
  } catch {
    // Ignore when native plugin not installed yet
  }
}

export async function getAndroidAlertPermissions(): Promise<AndroidAlertPermissionsStatus> {
  const plugin = getKairoAlarmPlugin();
  if (!plugin) {
    return {
      isNativeAndroid: false,
      postNotifications: false,
      exactAlarms: false,
      fullScreenIntent: false,
      overlayPermission: false,
      batteryOptimizationIgnored: false,
    };
  }
  try {
    const status = await plugin.getPermissionStatus();
    return { isNativeAndroid: true, ...status };
  } catch {
    return {
      isNativeAndroid: true,
      postNotifications: false,
      exactAlarms: false,
      fullScreenIntent: false,
      overlayPermission: false,
      batteryOptimizationIgnored: false,
    };
  }
}

export type AndroidPermissionAction =
  | 'notifications'
  | 'exactAlarm'
  | 'fullScreen'
  | 'overlay'
  | 'battery';

export async function triggerAndroidPermissionSetting(
  kind: AndroidPermissionAction
): Promise<void> {
  const plugin = getKairoAlarmPlugin();
  if (!plugin) return;
  try {
    if (kind === 'notifications') {
      await plugin.requestNotificationPermission();
    } else if (kind === 'exactAlarm') {
      await plugin.openExactAlarmSettings();
    } else if (kind === 'fullScreen') {
      await plugin.openFullScreenIntentSettings();
    } else if (kind === 'overlay') {
      await plugin.openOverlaySettings();
    } else if (kind === 'battery') {
      await plugin.openBatterySettings();
    }
  } catch {
    // Ignore
  }
}

export async function notifyNativeServiceAction(
  action: 'stop' | 'snooze'
): Promise<void> {
  const plugin = getKairoAlarmPlugin();
  if (!plugin) return;
  try {
    await plugin.stopActiveAlert({ action });
  } catch {
    // Ignore
  }
}
