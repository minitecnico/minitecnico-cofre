import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StickyNote, Plus, Pin, PinOff, Trash2, Check,
} from 'lucide-react';
import { noteService } from '../services/goals';
import Modal from './Modal';

const NOTE_COLORS = [
  '#fef3c7', // amarelo
  '#fce7f3', // rosa
  '#dbeafe', // azul claro
  '#d1fae5', // verde claro
  '#e9d5ff', // roxo claro
  '#fed7aa', // laranja
];

/**
 * Painel de Notas / Bloco de notas.
 * Cada nota é um "post-it" com:
 *   - título opcional
 *   - corpo (auto-save com debounce)
 *   - cor de fundo
 *   - pinned (fica no topo)
 */
export default function NotesEditor() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await noteService.list();
      setNotes(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(payload) {
    const created = await noteService.create(payload);
    setNotes((prev) => [created, ...prev]);
    setCreating(false);
  }

  async function handleUpdate(id, patch) {
    // Otimista
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    try {
      await noteService.update(id, patch);
    } catch (err) {
      // Em caso de erro, recarrega
      console.error(err);
      load();
    }
  }

  async function handleTogglePin(note) {
    const newPinned = !note.pinned;
    setNotes((prev) => {
      const updated = prev.map((n) => (n.id === note.id ? { ...n, pinned: newPinned } : n));
      // Reordena: pinned primeiro
      updated.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
      return updated;
    });
    await noteService.togglePin(note.id, newPinned);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await noteService.remove(confirmDelete.id);
    setNotes((prev) => prev.filter((n) => n.id !== confirmDelete.id));
    setConfirmDelete(null);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-40 bg-ink-100 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg md:text-xl font-bold tracking-tight">
          Suas notas <span className="text-sm text-ink-500 font-mono">({notes.length})</span>
        </h3>
        <button
          onClick={() => setCreating(true)}
          className="btn-accent !py-2 !px-3 !text-sm"
        >
          <Plus className="w-4 h-4" /> Nova nota
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="card-flat p-8 md:p-12 text-center">
          <StickyNote className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 text-ink-300" strokeWidth={1.75} />
          <p className="font-display text-lg md:text-xl font-bold mb-2">Nenhuma nota ainda</p>
          <p className="text-xs md:text-sm text-ink-500 mb-4">
            Anote ideias, lembretes, listas de compras — o que quiser. Salva sozinho enquanto você digita.
          </p>
          <button onClick={() => setCreating(true)} className="btn-accent">
            <Plus className="w-5 h-5" /> Criar primeira nota
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdate={(patch) => handleUpdate(note.id, patch)}
              onTogglePin={() => handleTogglePin(note)}
              onDelete={() => setConfirmDelete(note)}
            />
          ))}
        </div>
      )}

      <Modal isOpen={creating} onClose={() => setCreating(false)} title="Nova nota">
        <NoteForm onSaved={handleCreate} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Excluir nota">
        {confirmDelete && (
          <div className="space-y-4">
            <p className="text-sm">
              Excluir essa nota? <strong>Esta ação não pode ser desfeita.</strong>
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-ghost">Cancelar</button>
              <button
                onClick={handleDelete}
                className="flex-1 px-5 py-3 min-h-[44px] bg-negative text-white font-bold rounded-xl shadow-soft-md hover:shadow-soft-lg transition-all duration-200"
              >
                Excluir
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Card de nota com auto-save (debounce de 800ms)
// ─────────────────────────────────────────────────────────────────────────

function NoteCard({ note, onUpdate, onTogglePin, onDelete }) {
  const [content, setContent] = useState(note.content || '');
  const [title, setTitle] = useState(note.title || '');
  const [savedAt, setSavedAt] = useState(null);
  const debounceTimer = useRef(null);
  const isFirstRender = useRef(true);

  // Sincroniza com prop quando a nota é alterada externamente
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setContent(note.content || '');
    setTitle(note.title || '');
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save
  const scheduleSave = useCallback((patch) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
        await noteService.updateContent(note.id, patch.content ?? content);
        // Se mudou title, salva separadamente
        if (patch.title !== undefined && patch.title !== note.title) {
          await noteService.update(note.id, { title: patch.title });
        }
        setSavedAt(new Date());
      } catch (err) {
        console.error(err);
      }
    }, 800);
  }, [note.id, note.title, content]);

  function handleContentChange(e) {
    const val = e.target.value;
    setContent(val);
    scheduleSave({ content: val, title });
  }

  function handleTitleChange(e) {
    const val = e.target.value;
    setTitle(val);
    scheduleSave({ content, title: val });
  }

  async function handleColorChange(newColor) {
    await onUpdate({ color: newColor });
  }

  return (
    <div
      className="rounded-2xl shadow-soft hover:shadow-soft-md p-4 transition-all duration-200 border border-ink-200/50 relative group"
      style={{ backgroundColor: note.color || '#fef3c7' }}
    >
      {/* Toolbar topo */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Título…"
          className="flex-1 min-w-0 bg-transparent border-0 focus:outline-none text-base font-display font-bold tracking-tight placeholder:text-ink-500/50 text-ink-900"
          maxLength={80}
        />

        <div className="flex gap-0.5 flex-shrink-0">
          <button
            onClick={onTogglePin}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
              note.pinned ? 'text-ink-900 bg-ink-900/15' : 'text-ink-700 hover:bg-ink-900/10'
            }`}
            title={note.pinned ? 'Desafixar' : 'Fixar no topo'}
          >
            {note.pinned ? <Pin className="w-3.5 h-3.5" strokeWidth={2.5} /> : <PinOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-700 hover:text-negative hover:bg-red-100 transition-all opacity-0 group-hover:opacity-100"
            title="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <textarea
        value={content}
        onChange={handleContentChange}
        placeholder="Escreva aqui…"
        className="w-full bg-transparent border-0 focus:outline-none text-sm text-ink-900 placeholder:text-ink-700/50 resize-none min-h-[120px] leading-relaxed"
        rows={6}
      />

      {/* Rodapé: cores + status */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-ink-900/10">
        <div className="flex gap-1">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => handleColorChange(c)}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                note.color === c ? 'border-ink-900 scale-110' : 'border-ink-900/20 hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>

        {savedAt && (
          <span className="text-[10px] text-ink-700/70 font-medium flex items-center gap-1">
            <Check className="w-3 h-3" /> Salvo
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Form: criar nova nota
// ─────────────────────────────────────────────────────────────────────────

function NoteForm({ onSaved, onCancel }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('#fef3c7');
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim() && !title.trim()) {
      onCancel();
      return;
    }
    setSubmitting(true);
    try {
      await onSaved({ title: title.trim() || null, content, color, pinned });
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Título (opcional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Lembrete importante"
          className="input-field"
          maxLength={80}
        />
      </div>

      <div>
        <label className="label">Conteúdo</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva aqui…"
          className="input-field min-h-[120px] resize-none"
          rows={6}
          autoFocus
        />
      </div>

      <div>
        <label className="label">Cor</label>
        <div className="flex gap-2 flex-wrap">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-10 h-10 rounded-xl transition-all shadow-soft ${
                color === c ? 'ring-2 ring-ink-900 ring-offset-2 scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={pinned}
          onChange={(e) => setPinned(e.target.checked)}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm">Fixar no topo</span>
      </label>

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <button type="button" onClick={onCancel} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={submitting} className="btn-accent flex-1">
          {submitting ? 'Criando…' : 'Criar nota'}
        </button>
      </div>
    </form>
  );
}
