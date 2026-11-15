export type NavTab =
  | 'dashboard'
  | 'tasks'
  | 'reminders'
  | 'alarms'
  | 'notes'
  | 'settings';

export type PriorityLevel = 'low' | 'medium' | 'high';

export type ThemeMode = 'dark' | 'light';

export type AppFontFamily = 'jakarta' | 'manrope' | 'outfit' | 'lora' | 'mono';

export interface AppSettings {
  theme: ThemeMode;
  fontSizePx: number;
  fontFamily: AppFontFamily;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSizePx: 16,
  fontFamily: 'jakarta',
};

export interface TaskItem {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:MM
  durationMinutes: number;
  priority: PriorityLevel;
  completed: boolean;
  details?: string;
}

export type ReminderRepeat = 'once' | 'daily' | 'weekdays' | 'monthly' | 'yearly';

export interface ReminderItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  repeat: ReminderRepeat;
  priority: PriorityLevel;
  active: boolean;
  completed: boolean;
  note?: string;
}

export type AlarmTone = 'dawn' | 'amber' | 'zenith' | 'pulse' | 'custom';

export interface ChronoAlarm {
  id: string;
  hour24: number;
  minute: number;
  label: string;
  enabled: boolean;
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  tone: AlarmTone;
  customRingtoneId?: string;
  customRingtoneName?: string;
}

export type NoteCategory = 'General' | 'Work' | 'Ideas';

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  pinned: boolean;
  updatedAt: string; // ISO
}

export function formatDateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYMDToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function doesReminderOccurOnDate(
  reminder: ReminderItem,
  targetDateStr: string
): boolean {
  if (reminder.date === targetDateStr) return true;
  if (targetDateStr < reminder.date) return false;

  const targetDate = parseYMDToLocalDate(targetDateStr);
  const startDate = parseYMDToLocalDate(reminder.date);
  const targetWeekday = targetDate.getDay();

  if (reminder.repeat === 'daily') return true;
  if (reminder.repeat === 'weekdays') {
    return targetWeekday >= 1 && targetWeekday <= 5;
  }
  if (reminder.repeat === 'monthly') {
    const daysInTargetMonth = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth() + 1,
      0
    ).getDate();
    const clampedDay = Math.min(startDate.getDate(), daysInTargetMonth);
    return targetDate.getDate() === clampedDay;
  }
  if (reminder.repeat === 'yearly') {
    if (targetDate.getMonth() !== startDate.getMonth()) return false;
    const daysInTargetMonth = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth() + 1,
      0
    ).getDate();
    const clampedDay = Math.min(startDate.getDate(), daysInTargetMonth);
    return targetDate.getDate() === clampedDay;
  }
  return false;
}

export function getTodayDateString(): string {
  return formatDateToYMD(new Date());
}

export function getOffsetDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return formatDateToYMD(d);
}

export function getInitialTasks(): TaskItem[] {
  const today = getTodayDateString();
  const tomorrow = getOffsetDateString(1);
  return [
    {
      id: 'task-1',
      title: 'Finalize system architecture specification',
      dueDate: today,
      dueTime: '09:00',
      durationMinutes: 50,
      priority: 'high',
      completed: true,
      details: 'Review latency targets and database indexing plan',
    },
    {
      id: 'task-2',
      title: 'Build sprint deliverables & unit tests',
      dueDate: today,
      dueTime: '11:00',
      durationMinutes: 90,
      priority: 'high',
      completed: false,
      details: 'Zero notifications — core execution block',
    },
    {
      id: 'task-3',
      title: 'Design critique & UI polish review',
      dueDate: today,
      dueTime: '15:00',
      durationMinutes: 45,
      priority: 'medium',
      completed: false,
    },
    {
      id: 'task-4',
      title: 'Prepare weekly team sync agenda',
      dueDate: tomorrow,
      dueTime: '10:00',
      durationMinutes: 30,
      priority: 'low',
      completed: false,
    },
  ];
}

export function getInitialReminders(): ReminderItem[] {
  const today = getTodayDateString();
  return [
    {
      id: 'rem-1',
      title: 'Hydrate & step away from screen',
      date: today,
      time: '12:30',
      repeat: 'daily',
      priority: 'low',
      active: true,
      completed: false,
      note: '10 minute walk outdoors',
    },
    {
      id: 'rem-2',
      title: 'Submit expense report before cutoff',
      date: today,
      time: '16:30',
      repeat: 'once',
      priority: 'high',
      active: true,
      completed: false,
    },
    {
      id: 'rem-3',
      title: 'Evening shutdown & plan tomorrow',
      date: today,
      time: '18:30',
      repeat: 'weekdays',
      priority: 'medium',
      active: true,
      completed: false,
    },
  ];
}

export const INITIAL_ALARMS: ChronoAlarm[] = [
  {
    id: 'alarm-1',
    hour24: 6,
    minute: 15,
    label: 'Morning Wake',
    enabled: true,
    days: [1, 2, 3, 4, 5],
    tone: 'dawn',
  },
  {
    id: 'alarm-2',
    hour24: 9,
    minute: 55,
    label: 'Deep Work Start',
    enabled: true,
    days: [1, 2, 3, 4, 5],
    tone: 'zenith',
  },
  {
    id: 'alarm-3',
    hour24: 22,
    minute: 30,
    label: 'Wind Down',
    enabled: false,
    days: [0, 1, 2, 3, 4, 5, 6],
    tone: 'amber',
  },
];

export function getInitialNotes(): NoteItem[] {
  return [
    {
      id: 'note-1',
      title: 'Q4 Product Priorities',
      content:
        '1. Tighten onboarding latency under 400ms.\n2. Simplify mobile thumb navigation labels.\n3. Ship offline-first local persistence across all modules.',
      category: 'Work',
      pinned: true,
      updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: 'note-2',
      title: 'Weekend Reading & Recovery',
      content:
        'Finish chapters 4-6 of Designing Data-Intensive Applications. Keep Sunday morning screen-free until 10 AM.',
      category: 'General',
      pinned: false,
      updatedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    },
    {
      id: 'note-3',
      title: 'Voice Note Concepts',
      content:
        'Explore acoustic cues for focus transitions: soft harmonic bell on completion, gentle rain filter during sprints.',
      category: 'Ideas',
      pinned: false,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    },
  ];
}
