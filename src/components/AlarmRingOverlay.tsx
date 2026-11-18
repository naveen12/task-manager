import React from 'react';
import { AlarmClock, Bell, BellRing, CheckSquare, Clock, Square } from 'lucide-react';
import type { ActiveAlert, AlertSourceType } from '../utils/notificationEngine';

interface AlarmRingOverlayProps {
  alert: ActiveAlert | null;
  queueCount?: number;
  onSnooze: () => void;
  onStop: () => void;
}

const TYPE_STYLE: Record<
  AlertSourceType,
  {
    label: string;
    accentText: string;
    iconWrap: string;
    border: string;
    glow: string;
    stopBtn: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  alarm: {
    label: 'Alarm',
    accentText: 'text-amber-600 dark:text-[#F59E0B]',
    iconWrap:
      'bg-amber-50 dark:bg-[#F59E0B]/15 text-amber-600 dark:text-[#F59E0B] border-amber-300 dark:border-[#F59E0B]/35',
    border: 'border-amber-400/60 dark:border-[#F59E0B]/45',
    glow: 'bg-[#F59E0B]/20',
    stopBtn:
      'bg-[#F59E0B] text-[#090A0F] shadow-[0_0_24px_rgba(245,158,11,0.4)] hover:bg-[#fbbf24]',
    Icon: AlarmClock,
  },
  reminder: {
    label: 'Reminder',
    accentText: 'text-emerald-600 dark:text-[#34D399]',
    iconWrap:
      'bg-emerald-50 dark:bg-[#10B981]/15 text-emerald-600 dark:text-[#34D399] border-emerald-300 dark:border-[#10B981]/35',
    border: 'border-emerald-400/60 dark:border-[#10B981]/45',
    glow: 'bg-[#10B981]/20',
    stopBtn:
      'bg-[#10B981] text-white dark:text-[#090A0F] shadow-[0_0_24px_rgba(16,185,129,0.38)] hover:bg-[#34d399]',
    Icon: Bell,
  },
  task: {
    label: 'Task',
    accentText: 'text-indigo-600 dark:text-[#818CF8]',
    iconWrap:
      'bg-indigo-50 dark:bg-[#6366F1]/15 text-indigo-600 dark:text-[#818CF8] border-indigo-300 dark:border-[#6366F1]/35',
    border: 'border-indigo-400/60 dark:border-[#6366F1]/45',
    glow: 'bg-[#6366F1]/25',
    stopBtn:
      'bg-gradient-to-r from-[#6366F1] to-[#818CF8] text-white shadow-[0_0_24px_rgba(99,102,241,0.42)] hover:opacity-95',
    Icon: CheckSquare,
  },
};

export const AlarmRingOverlay: React.FC<AlarmRingOverlayProps> = ({
  alert,
  queueCount = 1,
  onSnooze,
  onStop,
}) => {
  if (!alert) return null;

  const style = TYPE_STYLE[alert.type];
  const TypeIcon = style.Icon ?? BellRing;
  const snoozeMins = alert.snoozeMinutes && alert.snoozeMinutes > 0 ? alert.snoozeMinutes : 5;
  const modeLabel =
    alert.vibrationMode === 'vibrate_only'
      ? ' · Vibrate Only'
      : alert.vibrationMode === 'sound_only'
      ? ' · Sound Only'
      : '';

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="active-alert-name"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 dark:bg-[#050609]/96 backdrop-blur-2xl p-4 sm:p-6"
    >
      <div
        className={`relative w-full max-w-sm overflow-hidden rounded-[32px] bg-white dark:bg-[#141622] border ${style.border} p-6 sm:p-8 text-center shadow-2xl`}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-44 w-44 rounded-full ${style.glow} blur-[64px]`}
        />

        {/* Minimal Info 1: Type + Time */}
        <div
          className={`relative z-10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border ${style.iconWrap}`}
        >
          <TypeIcon className="h-7 w-7" />
        </div>

        <p className={`relative z-10 text-xs font-semibold tracking-wider uppercase tabular-nums ${style.accentText}`}>
          {style.label} · {alert.timeLabel}{modeLabel}
        </p>

        {/* Minimal Info 2: Name */}
        <h2
          id="active-alert-name"
          className="relative z-10 mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC] text-balance break-words"
        >
          {alert.name}
        </h2>

        {queueCount > 1 && (
          <p className="relative z-10 mt-2 text-xs text-slate-500 dark:text-[#94A3B8] tabular-nums">
            1 of {queueCount} active alerts
          </p>
        )}

        {/* Arranged Side-by-Side Snooze & Stop Action Buttons */}
        <div className="relative z-10 mt-8 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onSnooze}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 dark:bg-white/[0.08] px-4 text-sm font-semibold text-slate-900 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/15 hover:bg-slate-200/80 dark:hover:bg-white/15 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
          >
            <Clock className={`h-4 w-4 shrink-0 ${style.accentText}`} />
            <span>Snooze {snoozeMins}m</span>
          </button>

          <button
            type="button"
            onClick={onStop}
            className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap ${style.stopBtn}`}
          >
            <Square className="h-3.5 w-3.5 fill-current shrink-0" />
            <span>Stop</span>
          </button>
        </div>
      </div>
    </div>
  );
};
