import React from 'react';
import type { User } from 'firebase/auth';
import { Minus, Moon, Plus, RotateCcw, Sun, Type } from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  type AppFontFamily,
  type AppSettings,
  type ChronoAlarm,
  type NoteItem,
  type ReminderItem,
  type TaskItem,
  type ThemeMode,
} from '../types/chrono';
import { BackupSection } from './BackupSection';
import type { ChronoBackupPayload } from '../utils/googleDriveBackup';
import { soundEngine } from '../utils/soundEngine';

interface SettingsSectionProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  googleUser: User | null;
  needsGoogleAuth: boolean;
  onAuthUpdated: (user: User | null, needsAuth: boolean) => void;
  tasks: TaskItem[];
  reminders: ReminderItem[];
  alarms: ChronoAlarm[];
  notes: NoteItem[];
  onRestoreBackup: (payload: ChronoBackupPayload) => void;
}

const FONT_OPTIONS: {
  id: AppFontFamily;
  name: string;
  subtitle: string;
  cssFamily: string;
}[] = [
  {
    id: 'jakarta',
    name: 'Plus Jakarta Sans',
    subtitle: 'Modern geometric default',
    cssFamily: '"Plus Jakarta Sans", "DM Sans", sans-serif',
  },
  {
    id: 'manrope',
    name: 'Manrope',
    subtitle: 'Crisp humanist neo-grotesque',
    cssFamily: '"Manrope", sans-serif',
  },
  {
    id: 'outfit',
    name: 'Outfit',
    subtitle: 'Clean rounded display',
    cssFamily: '"Outfit", sans-serif',
  },
  {
    id: 'lora',
    name: 'Lora',
    subtitle: 'Warm editorial serif',
    cssFamily: '"Lora", Georgia, serif',
  },
  {
    id: 'mono',
    name: 'JetBrains Mono',
    subtitle: 'Precision monospace',
    cssFamily: '"JetBrains Mono", monospace',
  },
];

const SIZE_PRESETS = [
  { label: 'Compact', px: 14 },
  { label: 'Default', px: 16 },
  { label: 'Large', px: 18 },
  { label: 'Extra Large', px: 20 },
];

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  settings,
  onUpdateSettings,
  googleUser,
  needsGoogleAuth,
  onAuthUpdated,
  tasks,
  reminders,
  alarms,
  notes,
  onRestoreBackup,
}) => {
  const setTheme = (theme: ThemeMode) => {
    soundEngine.playTick(840, 0.02);
    onUpdateSettings({ ...settings, theme });
  };

  const setFontSize = (px: number) => {
    const clamped = Math.max(13, Math.min(22, px));
    soundEngine.playTick(780, 0.015);
    onUpdateSettings({ ...settings, fontSizePx: clamped });
  };

  const setFontFamily = (fontFamily: AppFontFamily) => {
    soundEngine.playTick(860, 0.02);
    onUpdateSettings({ ...settings, fontFamily });
  };

  return (
    <section className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            Appearance & Settings
          </h2>
          <p className="text-xs text-slate-600 dark:text-[#94A3B8] mt-0.5">
            Customize theme, font size, typography, and Google Drive backups
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playTick(680, 0.02);
            onUpdateSettings(DEFAULT_SETTINGS);
          }}
          className="flex min-h-[40px] items-center gap-2 rounded-full bg-slate-200/70 dark:bg-white/[0.05] px-4 text-xs font-medium text-slate-700 dark:text-[#94A3B8] border border-slate-300/70 dark:border-white/10 hover:text-slate-900 dark:hover:text-[#F8FAFC] transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Defaults
        </button>
      </div>

      {/* Theme Mode Card */}
      <div className="rounded-[28px] bg-white dark:bg-[#1A1D2D]/80 border border-slate-200 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm dark:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-[#F8FAFC]">
              Theme
            </h3>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-[#94A3B8]">
              Switch between Obsidian Dark and Daylight Light mode
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="App theme"
            className="inline-flex rounded-full bg-slate-100 dark:bg-[#12141F] p-1 border border-slate-200 dark:border-white/[0.06] self-start"
          >
            <button
              type="button"
              role="radio"
              aria-checked={settings.theme === 'dark'}
              onClick={() => setTheme('dark')}
              className={`flex min-h-[40px] items-center gap-2 rounded-full px-4 text-xs font-semibold transition-all cursor-pointer ${
                settings.theme === 'dark'
                  ? 'bg-[#1A1D2D] text-white shadow-sm border border-white/15'
                  : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              Dark
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={settings.theme === 'light'}
              onClick={() => setTheme('light')}
              className={`flex min-h-[40px] items-center gap-2 rounded-full px-4 text-xs font-semibold transition-all cursor-pointer ${
                settings.theme === 'light'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              Light
            </button>
          </div>
        </div>
      </div>

      {/* Font Size Card */}
      <div className="rounded-[28px] bg-white dark:bg-[#1A1D2D]/80 border border-slate-200 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm dark:shadow-none flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-[#6366F1]/15 text-indigo-600 dark:text-[#818CF8]">
              <Type className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-[#F8FAFC]">
                Font Size
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#94A3B8]">
                Adjust base text scale across all screens
              </p>
            </div>
          </div>

          <span className="font-mono text-sm font-semibold text-indigo-600 dark:text-[#818CF8] tabular-nums">
            {settings.fontSizePx}px
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFontSize(settings.fontSizePx - 1)}
            disabled={settings.fontSizePx <= 13}
            aria-label="Decrease font size"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-[#12141F] text-slate-700 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/10 disabled:opacity-40 cursor-pointer"
          >
            <Minus className="h-4 w-4" />
          </button>

          <input
            type="range"
            min={13}
            max={22}
            step={1}
            value={settings.fontSizePx}
            onChange={(e) => setFontSize(Number(e.target.value))}
            aria-label="Font size slider"
            className="flex-1 accent-[#6366F1] cursor-pointer"
          />

          <button
            type="button"
            onClick={() => setFontSize(settings.fontSizePx + 1)}
            disabled={settings.fontSizePx >= 22}
            aria-label="Increase font size"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-[#12141F] text-slate-700 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/10 disabled:opacity-40 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SIZE_PRESETS.map((preset) => {
            const active = settings.fontSizePx === preset.px;
            return (
              <button
                key={preset.px}
                type="button"
                onClick={() => setFontSize(preset.px)}
                className={`min-h-[42px] rounded-2xl px-3 text-xs font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-[0_0_14px_rgba(99,102,241,0.35)]'
                    : 'bg-slate-100 dark:bg-[#12141F] text-slate-700 dark:text-[#94A3B8] border border-slate-200 dark:border-white/[0.06] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
                }`}
              >
                {preset.label} ({preset.px}px)
              </button>
            );
          })}
        </div>
      </div>

      {/* App Font Family Selector */}
      <div className="rounded-[28px] bg-white dark:bg-[#1A1D2D]/80 border border-slate-200 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm dark:shadow-none flex flex-col gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-[#F8FAFC]">
            App Font
          </h3>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-[#94A3B8]">
            Choose the typeface used for headings, tasks, reminders, and notes
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {FONT_OPTIONS.map((font) => {
            const active = settings.fontFamily === font.id;
            return (
              <button
                key={font.id}
                type="button"
                onClick={() => setFontFamily(font.id)}
                style={{ fontFamily: font.cssFamily }}
                className={`flex flex-col items-start rounded-2xl p-4 text-left transition-all border cursor-pointer ${
                  active
                    ? 'bg-indigo-50 dark:bg-[#6366F1]/15 border-indigo-500 dark:border-[#6366F1]/60'
                    : 'bg-slate-50 dark:bg-[#12141F] border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/15'
                }`}
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-[#F8FAFC]">
                  {font.name}
                </span>
                <span className="mt-0.5 text-xs text-slate-600 dark:text-[#94A3B8]">
                  {font.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Embedded Google Drive Backup & Local Export/Import inside Settings */}
      <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08]">
        <BackupSection
          user={googleUser}
          needsAuth={needsGoogleAuth}
          onAuthUpdated={onAuthUpdated}
          tasks={tasks}
          reminders={reminders}
          alarms={alarms}
          notes={notes}
          onRestoreBackup={onRestoreBackup}
        />
      </div>
    </section>
  );
};
