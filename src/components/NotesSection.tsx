import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Pin, Plus, Search, Trash2, X } from 'lucide-react';
import type { NoteCategory, NoteItem } from '../types/chrono';
import { soundEngine } from '../utils/soundEngine';

interface NotesSectionProps {
  notes: NoteItem[];
  autoOpenCreateKey?: number;
  onCreateNote: (note: Omit<NoteItem, 'id' | 'updatedAt'>) => void;
  onUpdateNote: (id: string, updates: Omit<NoteItem, 'id' | 'updatedAt'>) => void;
  onDeleteNote: (id: string) => void;
  onTogglePin: (id: string) => void;
}

const CATEGORIES: NoteCategory[] = ['General', 'Work', 'Ideas'];

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const NotesSection: React.FC<NotesSectionProps> = ({
  notes,
  autoOpenCreateKey,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onTogglePin,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'All' | NoteCategory>('All');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteCategory>('General');
  const [pinned, setPinned] = useState(false);

  const openCreate = () => {
    soundEngine.playTick(840, 0.02);
    setEditingNote(null);
    setTitle('');
    setContent('');
    setCategory('General');
    setPinned(false);
    setEditorOpen(true);
  };

  useEffect(() => {
    if (autoOpenCreateKey && autoOpenCreateKey > 0) {
      openCreate();
    }
  }, [autoOpenCreateKey]);

  const openEdit = (note: NoteItem) => {
    soundEngine.playTick(800, 0.02);
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setPinned(note.pinned);
    setEditorOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !content.trim()) return;
    soundEngine.playTick(980, 0.03);

    const payload = {
      title: title.trim() || 'Untitled Note',
      content: content.trim(),
      category,
      pinned,
    };

    if (editingNote) {
      onUpdateNote(editingNote.id, payload);
    } else {
      onCreateNote(payload);
    }
    setEditorOpen(false);
    setEditingNote(null);
  };

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes
      .filter((n) => (categoryFilter === 'All' ? true : n.category === categoryFilter))
      .filter((n) =>
        q
          ? n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [notes, categoryFilter, search]);

  return (
    <section className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            Notes
          </h2>
          <p className="text-xs text-slate-600 dark:text-[#94A3B8] tabular-nums mt-0.5">
            {notes.filter((n) => n.pinned).length} pinned · {notes.length} total
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="flex min-h-[44px] items-center gap-2 rounded-full bg-gradient-to-r from-[#6366F1] to-[#818CF8] px-5 py-2 text-xs font-semibold text-white shadow-[0_0_16px_rgba(99,102,241,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          New Note
        </button>
      </div>

      {/* Category Filter & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter notes by category"
          className="inline-flex self-start rounded-full bg-slate-100 dark:bg-[#12141F] p-1 border border-slate-200 dark:border-white/[0.06]"
        >
          {(['All', ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={categoryFilter === cat}
              onClick={() => {
                soundEngine.playTick(780, 0.02);
                setCategoryFilter(cat);
              }}
              className={`min-h-[36px] rounded-full px-4 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-white dark:bg-[#1A1D2D] text-slate-900 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/15 shadow-xs'
                  : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] border border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-[#64748B]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            aria-label="Search notes"
            className="min-h-[44px] w-full rounded-full bg-white dark:bg-[#12141F] pl-10 pr-4 text-sm text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-[#64748B] border border-slate-200 dark:border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
          />
        </div>
      </div>

      {/* Create / Edit Note Form */}
      {editorOpen && (
        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] bg-white dark:bg-[#1A1D2D] border border-indigo-300 dark:border-[#6366F1]/40 p-5 flex flex-col gap-4 shadow-lg dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-[#F8FAFC]">
              {editingNote ? 'Edit Note' : 'Create Note'}
            </h3>
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              aria-label="Close note editor"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-[#F8FAFC] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="note-title-input"
                className="block text-xs font-medium text-slate-600 dark:text-[#94A3B8] mb-1.5"
              >
                Title
              </label>
              <input
                id="note-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title..."
                required
                className="min-h-[48px] w-full rounded-2xl bg-slate-50 dark:bg-[#161926] px-4 text-sm text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-[#64748B] border border-slate-200 dark:border-white/[0.08] focus:border-[#6366F1] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="note-category-select"
                className="block text-xs font-medium text-slate-600 dark:text-[#94A3B8] mb-1.5"
              >
                Category
              </label>
              <select
                id="note-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as NoteCategory)}
                className="min-h-[48px] w-full rounded-2xl bg-slate-50 dark:bg-[#161926] px-3.5 text-sm text-slate-900 dark:text-[#F8FAFC] border border-slate-200 dark:border-white/[0.08] focus:border-[#6366F1] focus:outline-none cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="note-content-input"
              className="block text-xs font-medium text-slate-600 dark:text-[#94A3B8] mb-1.5"
            >
              Content
            </label>
            <textarea
              id="note-content-input"
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write ideas, meeting highlights, or checklists..."
              className="w-full rounded-2xl bg-slate-50 dark:bg-[#161926] p-4 text-sm leading-relaxed text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-[#64748B] border border-slate-200 dark:border-white/[0.08] focus:border-[#6366F1] focus:outline-none resize-y"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => setPinned((p) => !p)}
              className={`flex min-h-[40px] items-center gap-2 rounded-full px-4 text-xs font-medium border transition-colors cursor-pointer ${
                pinned
                  ? 'bg-indigo-50 dark:bg-[#6366F1]/20 text-indigo-700 dark:text-[#c0c1ff] border-indigo-300 dark:border-[#6366F1]/40'
                  : 'bg-slate-100 dark:bg-[#12141F] text-slate-600 dark:text-[#94A3B8] border-slate-200 dark:border-white/[0.06]'
              }`}
            >
              <Pin className="h-3.5 w-3.5" />
              {pinned ? 'Pinned to top' : 'Pin note'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="min-h-[44px] rounded-full px-5 text-xs font-medium text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-full bg-gradient-to-r from-[#6366F1] to-[#818CF8] px-6 text-xs font-semibold text-white shadow-[0_0_16px_rgba(99,102,241,0.4)] cursor-pointer"
              >
                {editingNote ? 'Save Changes' : 'Save Note'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="rounded-[28px] bg-white/70 dark:bg-[#1A1D2D]/50 border border-slate-200 dark:border-white/[0.06] p-8 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-[#F8FAFC]">
            No notes yet
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#64748B]">
            Capture quick thoughts, meeting notes, or daily reflections.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredNotes.map((note) => (
            <article
              key={note.id}
              className={`flex flex-col justify-between rounded-[26px] p-5 transition-all border shadow-xs dark:shadow-none ${
                note.pinned
                  ? 'bg-white dark:bg-[#1A1D2D] border-indigo-300 dark:border-[#6366F1]/40'
                  : 'bg-white dark:bg-[#1A1D2D]/75 border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/15'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-[#94A3B8]">
                  <span>
                    {note.category} · {formatUpdated(note.updatedAt)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onTogglePin(note.id)}
                      aria-label={note.pinned ? `Unpin ${note.title}` : `Pin ${note.title}`}
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors cursor-pointer ${
                        note.pinned
                          ? 'text-indigo-600 dark:text-[#818CF8] bg-indigo-50 dark:bg-[#6366F1]/15'
                          : 'text-slate-400 dark:text-[#64748B] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
                      }`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(note)}
                      aria-label={`Edit ${note.title}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteNote(note.id)}
                      aria-label={`Delete ${note.title}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 dark:text-[#64748B] hover:bg-red-50 dark:hover:bg-white/[0.06] hover:text-red-600 dark:hover:text-[#ffb4ab] transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-[#F8FAFC]">
                  {note.title}
                </h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-[#94A3B8] line-clamp-4">
                  {note.content}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
