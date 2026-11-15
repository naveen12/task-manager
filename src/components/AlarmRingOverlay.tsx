import React from 'react';
import { BellRing, Clock } from 'lucide-react';
import type { ChronoAlarm } from '../types/chrono';

interface AlarmRingOverlayProps {
  alarm: ChronoAlarm | null;
  onSnooze: () => void;
  onDismiss: () => void;
}

export const AlarmRingOverlay: React.FC<AlarmRingOverlayProps> = ({
  alarm,
  onSnooze,
  onDismiss,
}) => {
  if (!alarm) return null;

  const h12 = alarm.hour24 % 12 || 12;
  const period = alarm.hour24 >= 12 ? 'PM' : 'AM';
  const formatted = `${String(h12).padStart(2, '0')}:${String(alarm.minute).padStart(2, '0')}`;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alarm-ring-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 dark:bg-[#090A0F]/90 backdrop-blur-2xl p-5"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[32px] bg-white dark:bg-[#1A1D2D] border border-amber-400/60 dark:border-[#F59E0B]/40 p-8 text-center shadow-[0_0_80px_rgba(245,158,11,0.28)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-[#F59E0B]/20 blur-[64px]"
        />

        <div className="relative z-10 mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-[#F59E0B]/15 text-amber-600 dark:text-[#F59E0B] border border-amber-300 dark:border-[#F59E0B]/30">
          <BellRing className="h-8 w-8" />
        </div>

        <p className="relative z-10 text-xs font-semibold uppercase tracking-[0.12em] text-amber-600 dark:text-[#F59E0B]">
          Alarm Active
        </p>

        <div className="relative z-10 mt-3 flex items-baseline justify-center gap-2 font-mono tabular-nums">
          <span className="text-5xl font-semibold tracking-tight text-slate-900 dark:text-[#F8FAFC]">
            {formatted}
          </span>
          <span className="text-lg font-medium text-amber-600 dark:text-[#F59E0B]">
            {period}
          </span>
        </div>

        <h2
          id="alarm-ring-title"
          className="relative z-10 mt-3 text-xl font-semibold text-slate-900 dark:text-[#F8FAFC]"
        >
          {alarm.label || 'Kairo Alarm'}
        </h2>

        <div className="relative z-10 mt-8 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onSnooze}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-slate-100 dark:bg-white/[0.06] px-6 text-sm font-semibold text-slate-900 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/15 hover:bg-slate-200/70 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Clock className="h-4 w-4 text-amber-600 dark:text-[#F59E0B]" />
            Snooze 5 min
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="flex h-12 flex-1 items-center justify-center rounded-full bg-[#F59E0B] px-6 text-sm font-semibold text-[#090A0F] shadow-[0_0_24px_rgba(245,158,11,0.4)] hover:bg-[#fbbf24] active:scale-[0.98] transition-all cursor-pointer"
          >
            Dismiss Alarm
          </button>
        </div>
      </div>
    </div>
  );
};
