import React, { useState } from 'react';
import { BellRing, Pencil, Plus, Trash2, Volume2 } from 'lucide-react';
import type { AlarmTone, ChronoAlarm } from '../types/chrono';
import { GlowingToggle } from './GlowingToggle';
import { TemporalWheel } from './TemporalWheel';
import { soundEngine } from '../utils/soundEngine';

interface AlarmsSectionProps {
  alarms: ChronoAlarm[];
  onToggleAlarm: (id: string, enabled: boolean) => void;
  onSaveAlarm: (alarm: Omit<ChronoAlarm, 'id'>, existingId?: string) => void;
  onDeleteAlarm: (id: string) => void;
  onTriggerTestRing: (alarm: ChronoAlarm) => void;
}

const WEEK_DAYS = [
  { idx: 1, short: 'M', name: 'Monday' },
  { idx: 2, short: 'T', name: 'Tuesday' },
  { idx: 3, short: 'W', name: 'Wednesday' },
  { idx: 4, short: 'T', name: 'Thursday' },
  { idx: 5, short: 'F', name: 'Friday' },
  { idx: 6, short: 'S', name: 'Saturday' },
  { idx: 0, short: 'S', name: 'Sunday' },
];

const TONES: { id: AlarmTone; label: string }[] = [
  { id: 'dawn', label: 'Dawn Chime' },
  { id: 'zenith', label: 'Zenith Bell' },
  { id: 'amber', label: 'Amber Tone' },
  { id: 'pulse', label: 'Crisp Pulse' },
];

function formatDaysSummary(days: number[]): string {
  if (days.length === 7) return 'Every day';
  if (days.length === 0) return 'Once';
  const sorted = [...days].sort((a, b) => a - b).join(',');
  if (sorted === '1,2,3,4,5') return 'Weekdays';
  if (sorted === '0,6') return 'Weekends';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.map((d) => names[d]).join(' ');
}

export const AlarmsSection: React.FC<AlarmsSectionProps> = ({
  alarms,
  onToggleAlarm,
  onSaveAlarm,
  onDeleteAlarm,
  onTriggerTestRing,
}) => {
  const [editingId, setEditingId] = useState<string | null>(
    alarms[0]?.id ?? null
  );
  const [hour24, setHour24] = useState<number>(alarms[0]?.hour24 ?? 6);
  const [minute, setMinute] = useState<number>(alarms[0]?.minute ?? 30);
  const [label, setLabel] = useState<string>(alarms[0]?.label ?? 'Morning Wake');
  const [days, setDays] = useState<number[]>(alarms[0]?.days ?? [1, 2, 3, 4, 5]);
  const [tone, setTone] = useState<AlarmTone>(alarms[0]?.tone ?? 'dawn');

  const loadAlarmIntoEditor = (alarm: ChronoAlarm) => {
    soundEngine.playTick(800, 0.02);
    setEditingId(alarm.id);
    setHour24(alarm.hour24);
    setMinute(alarm.minute);
    setLabel(alarm.label);
    setDays(alarm.days);
    setTone(alarm.tone);
  };

  const startNewAlarm = () => {
    soundEngine.playTick(920, 0.02);
    setEditingId(null);
    setHour24(7);
    setMinute(0);
    setLabel('Focus Checkpoint');
    setDays([1, 2, 3, 4, 5]);
    setTone('zenith');
  };

  const toggleDay = (dayIdx: number) => {
    soundEngine.playTick(760, 0.015);
    setDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playTick(1020, 0.03);
    onSaveAlarm(
      {
        hour24,
        minute,
        label: label.trim() || 'Chrono Alarm',
        enabled: true,
        days,
        tone,
      },
      editingId ?? undefined
    );
  };

  const sortedAlarms = [...alarms].sort(
    (a, b) => a.hour24 * 60 + a.minute - (b.hour24 * 60 + b.minute)
  );

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Alarm List */}
      <div className="lg:col-span-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[#F8FAFC] tracking-tight">
              Chrono Alarms
            </h2>
            <p className="text-xs text-[#94A3B8] tabular-nums mt-0.5">
              {alarms.filter((a) => a.enabled).length} of {alarms.length} active
            </p>
          </div>

          <button
            type="button"
            onClick={startNewAlarm}
            className="flex h-11 items-center gap-2 rounded-full bg-white/[0.05] px-4 text-xs font-semibold text-[#F8FAFC] border border-white/10 hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 text-[#818CF8]" />
            New Alarm
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {sortedAlarms.map((alarm) => {
            const h12 = alarm.hour24 % 12 || 12;
            const period = alarm.hour24 >= 12 ? 'PM' : 'AM';
            const timeStr = `${String(h12).padStart(2, '0')}:${String(
              alarm.minute
            ).padStart(2, '0')}`;
            const isSelected = editingId === alarm.id;
            const toneLabel = TONES.find((t) => t.id === alarm.tone)?.label ?? 'Dawn Chime';

            return (
              <div
                key={alarm.id}
                onClick={() => loadAlarmIntoEditor(alarm)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    loadAlarmIntoEditor(alarm);
                  }
                }}
                className={`flex items-center justify-between gap-4 rounded-[28px] p-5 transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-[#1A1D2D] border-[#6366F1]/50 shadow-[0_0_24px_rgba(99,102,241,0.14)]'
                    : 'bg-[#1A1D2D]/65 border-white/[0.08] hover:border-white/15'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 font-mono tabular-nums">
                    <span
                      className={`text-3xl sm:text-4xl font-semibold tracking-tight ${
                        alarm.enabled ? 'text-[#F8FAFC]' : 'text-[#64748B]'
                      }`}
                    >
                      {timeStr}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        alarm.enabled ? 'text-[#F59E0B]' : 'text-[#64748B]'
                      }`}
                    >
                      {period}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-sm font-medium text-[#F8FAFC]">
                    {alarm.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#94A3B8]">
                    {formatDaysSummary(alarm.days)} · {toneLabel}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTriggerTestRing(alarm);
                    }}
                    title="Preview Alarm Ring"
                    aria-label={`Preview ${alarm.label}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors cursor-pointer"
                  >
                    <BellRing className="h-4 w-4" />
                  </button>

                  <GlowingToggle
                    checked={alarm.enabled}
                    onChange={(next) => onToggleAlarm(alarm.id, next)}
                    ariaLabel={`Toggle ${alarm.label}`}
                  />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadAlarmIntoEditor(alarm);
                    }}
                    aria-label={`Edit ${alarm.label}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-[#94A3B8] hover:bg-white/[0.06] hover:text-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAlarm(alarm.id);
                    }}
                    aria-label={`Delete ${alarm.label}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-[#64748B] hover:bg-white/[0.06] hover:text-[#ffb4ab] transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Temporal Wheel Editor */}
      <form
        onSubmit={handleSave}
        className="lg:col-span-6 rounded-[32px] bg-[#1A1D2D]/80 backdrop-blur-xl border border-white/[0.08] p-6 flex flex-col gap-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#F8FAFC]">
            {editingId ? 'Adjust Alarm Time' : 'Create New Alarm'}
          </h3>
          <span className="font-mono text-xs text-[#818CF8] tabular-nums">
            {String(hour24 % 12 || 12).padStart(2, '0')}:
            {String(minute).padStart(2, '0')} {hour24 >= 12 ? 'PM' : 'AM'}
          </span>
        </div>

        {/* Temporal Wheel Time Scroller */}
        <TemporalWheel
          hour24={hour24}
          minute={minute}
          onChange={(h, m) => {
            setHour24(h);
            setMinute(m);
          }}
        />

        {/* Label Input */}
        <div>
          <label
            htmlFor="alarm-label-input"
            className="block text-xs font-medium text-[#94A3B8] mb-1.5"
          >
            Alarm Label
          </label>
          <input
            id="alarm-label-input"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Morning Wake"
            className="h-[52px] w-full rounded-2xl bg-[#161926] px-4 text-[15px] text-[#F8FAFC] placeholder:text-[#64748B] border border-white/[0.08] focus:border-[#6366F1] focus:outline-none focus:ring-3 focus:ring-[#6366F1]/25"
          />
        </div>

        {/* Repeat Days */}
        <div>
          <span className="block text-xs font-medium text-[#94A3B8] mb-2">
            Repeat Cadence
          </span>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEK_DAYS.map((d) => {
              const selected = days.includes(d.idx);
              return (
                <button
                  key={d.idx}
                  type="button"
                  aria-label={d.name}
                  aria-pressed={selected}
                  onClick={() => toggleDay(d.idx)}
                  className={`flex h-11 items-center justify-center rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    selected
                      ? 'bg-[#6366F1] text-white shadow-[0_0_12px_rgba(99,102,241,0.45)]'
                      : 'bg-[#12141F] text-[#94A3B8] border border-white/[0.06] hover:text-[#F8FAFC]'
                  }`}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tone Selector */}
        <div>
          <span className="block text-xs font-medium text-[#94A3B8] mb-2">
            Acoustic Tone
          </span>
          <div className="grid grid-cols-2 gap-2">
            {TONES.map((t) => {
              const active = tone === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTone(t.id);
                    soundEngine.playAlarmToneOnce(t.id);
                  }}
                  className={`flex h-11 items-center justify-between rounded-2xl px-3.5 text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-[#6366F1]/20 text-[#F8FAFC] border border-[#6366F1]/50'
                      : 'bg-[#12141F] text-[#94A3B8] border border-white/[0.06] hover:text-[#F8FAFC]'
                  }`}
                >
                  <span>{t.label}</span>
                  <Volume2 className="h-3.5 w-3.5 opacity-70" />
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          className="mt-1 h-12 w-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#818CF8] text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,102,241,0.45),inset_0_1px_0_rgba(255,255,255,0.3)] active:scale-[0.98] transition-all cursor-pointer"
        >
          {editingId ? 'Update Alarm' : 'Save Alarm'}
        </button>
      </form>
    </section>
  );
};
