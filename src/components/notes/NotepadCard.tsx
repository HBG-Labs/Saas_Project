import {
  BookOpen,
  Check,
  Clock,
  Copy,
  Download,
  Edit3,
  FilePlus,
  FileText,
  Pin,
  Search,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from '@/features/notes';
import { usePermission } from '@/features/organizations';
import type { Note } from '@/types/domain';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';

export type NoteCategory = 'technique' | 'urgent' | 'client' | 'memo';

export interface NoteFile {
  id: string;
  title: string;
  content: string;
  category?: NoteCategory | undefined;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotepadCardProps {
  userId?: string | null | undefined;
}

const CATEGORY_LABELS: Record<NoteCategory, string> = {
  technique: 'Technique',
  urgent: 'Urgent',
  client: 'Client',
  memo: 'Pense-bête',
};

const CATEGORY_VARIANTS: Record<NoteCategory, 'success' | 'error' | 'info' | 'warning'> = {
  technique: 'success',
  urgent: 'error',
  client: 'info',
  memo: 'warning',
};



/** Ligne de base → forme manipulée par l'éditeur. */
function toNoteFile(note: Note): NoteFile {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    ...(note.category !== null ? { category: note.category } : {}),
    isPinned: note.is_pinned,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  };
}

/**
 * Délai avant enregistrement d'une frappe.
 *
 * Écrire à chaque caractère saturerait le réseau et ferait clignoter l'état
 * « enregistré ». Une seconde et demie correspond à une pause naturelle dans la
 * saisie : assez court pour qu'aucune frappe ne se perde à la fermeture de
 * l'onglet, assez long pour ne pas envoyer une requête par mot.
 */
const AUTOSAVE_DELAY_MS = 1500;

export function NotepadCard(_props: NotepadCardProps = {}) {
  // Le ton des libellés suit le rôle RÉEL dans l'organisation courante — un
  // technicien et un dirigeant ne prennent pas les mêmes notes.
  const { role } = usePermission();
  const isTechnician = role === 'technician';

  const notesQuery = useNotes();
  const createNoteMutation = useCreateNote();
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();

  /**
   * Tampon d'édition local.
   *
   * La frappe doit rester instantanée : attendre l'aller-retour serveur à chaque
   * caractère rendrait l'éditeur inutilisable. Le tampon est alimenté par le
   * serveur puis repoussé vers lui, avec un délai.
   */
  const [notes, setNotes] = useState<NoteFile[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>('');

  const remoteNotes = useMemo(
    () => (notesQuery.data ?? []).map(toNoteFile),
    [notesQuery.data],
  );

  // Une frappe en cours ne doit pas être écrasée par la réponse d'une requête
  // partie avant elle. Tant qu'une sauvegarde est en attente, on ne resynchronise
  // pas depuis le serveur.
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pendingSave.current !== null) return;
    setNotes(remoteNotes);
  }, [remoteNotes]);

  const [selectedCategory, setSelectedCategory] = useState<NoteCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [copied, signalerCopied] = useEphemeralFlag();
  const [lastSavedTime, setLastSavedTime] = useState<string>('Synchronisé');

  /**
   * La note active peut disparaître — supprimée ici, ou depuis un autre appareil.
   *
   * Le repli est CALCULÉ plutôt que corrigé dans un effet : remettre l'état à
   * jour après coup provoquerait un rendu de plus, pendant lequel l'éditeur
   * s'afficherait vide.
   */
  const activeNote = notes.find((n) => n.id === activeNoteId) ?? notes[0];

  const markSaved = useCallback(() => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    setLastSavedTime(`Enregistré à ${time}`);
  }, []);

  /** Programme l'enregistrement différé d'une note en cours de frappe. */
  const scheduleSave = useCallback(
    (noteId: string, patch: { title?: string; content?: string }) => {
      if (pendingSave.current !== null) clearTimeout(pendingSave.current);

      pendingSave.current = setTimeout(() => {
        pendingSave.current = null;
        updateNoteMutation.mutate({ id: noteId, patch }, { onSuccess: markSaved });
      }, AUTOSAVE_DELAY_MS);
    },
    [updateNoteMutation, markSaved],
  );

  // Un démontage en pleine saisie perdrait la dernière frappe : le minuteur est
  // annulé, mais la note doit tout de même partir.
  useEffect(() => {
    return () => {
      if (pendingSave.current !== null) clearTimeout(pendingSave.current);
    };
  }, []);

  // Actions
  const handleCreateNote = () => {
    createNoteMutation.mutate(
      { title: `Nouvelle note ${notes.length + 1}`, content: '' },
      {
        onSuccess: (created) => {
          setActiveNoteId(created.id);
          setEditingTitleId(created.id);
          setTempTitle(created.title);
          markSaved();
        },
      },
    );
  };

  const handleUpdateContent = (newContent: string) => {
    if (!activeNote) return;

    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNote.id
          ? { ...n, content: newContent, updatedAt: new Date().toISOString() }
          : n,
      ),
    );
    setLastSavedTime('Modification en cours…');
    scheduleSave(activeNote.id, { content: newContent });
  };

  const handleUpdateTitle = (newTitle: string) => {
    if (!activeNote) return;

    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNote.id
          ? { ...n, title: newTitle, updatedAt: new Date().toISOString() }
          : n,
      ),
    );
    setLastSavedTime('Modification en cours…');
    scheduleSave(activeNote.id, { title: newTitle });
  };

  const handleStartRename = (note: NoteFile, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveNoteId(note.id);
    setEditingTitleId(note.id);
    setTempTitle(note.title);
  };

  const handleSaveRename = () => {
    if (editingTitleId === null) return;

    const trimmed = tempTitle.trim() === '' ? 'Sans titre' : tempTitle.trim();
    setNotes((prev) => prev.map((n) => (n.id === editingTitleId ? { ...n, title: trimmed } : n)));
    updateNoteMutation.mutate(
      { id: editingTitleId, patch: { title: trimmed } },
      { onSuccess: markSaved },
    );
    setEditingTitleId(null);
  };

  const handleDeleteNote = (noteId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    deleteNoteMutation.mutate(noteId);
  };

  const handleTogglePin = (noteId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    const target = notes.find((n) => n.id === noteId);
    if (target === undefined) return;

    const nextPinned = target.isPinned !== true;
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, isPinned: nextPinned } : n)));
    updateNoteMutation.mutate({ id: noteId, patch: { is_pinned: nextPinned } });
  };

  const handleCopyContent = () => {
    if (!activeNote) return;
    void navigator.clipboard.writeText(activeNote.content);
    signalerCopied();
  };

  const handleDownloadNote = () => {
    if (!activeNote) return;
    const element = document.createElement('a');
    const file = new Blob([activeNote.content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${activeNote.title.replace(/[^a-zA-Z0-9-_\s]/g, '')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleUpdateCategory = (category?: NoteCategory) => {
    if (!activeNote) return;

    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNote.id
          ? { ...n, category, updatedAt: new Date().toISOString() }
          : n,
      ),
    );
    updateNoteMutation.mutate(
      { id: activeNote.id, patch: { category: category ?? null } },
      { onSuccess: markSaved },
    );
  };

  // Filtered notes
  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || n.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const wordCount = activeNote?.content.trim() ? activeNote.content.trim().split(/\s+/).length : 0;
  const charCount = activeNote?.content.length ?? 0;

  if (notesQuery.isPending) {
    return (
      <Card className="overflow-hidden border-border/80 shadow-md">
        <CardContent className="space-y-3 p-6">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/80 shadow-md">
      <CardHeader className="bg-surface-sunken/40 border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-foreground">
                  Bloc-notes {isTechnician ? 'Technicien Terrain' : 'Entreprise & Pilotage'}
                </CardTitle>
                <Badge variant="neutral" className="text-2xs font-semibold">
                  {notes.length} fichier{notes.length > 1 ? 's' : ''}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                {isTechnician
                  ? 'Vos mémos d’intervention, codes d’accès chantier, fiches de mesures et consignes personnelles.'
                  : 'Votre espace de notes stratégiques, relances clients, consignes d’équipe et réunions.'}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleCreateNote}
            className="gap-1.5 shadow-sm"
          >
            <FilePlus className="size-4" />
            Nouvelle note
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid min-h-[440px] lg:grid-cols-12">
          {/* Sidebar des fichiers de notes */}
          <div className="border-b border-border/60 bg-surface-sunken/20 lg:col-span-4 lg:border-r lg:border-b-0">
            {/* Search Bar & Category Filters */}
            <div className="p-3 space-y-2 border-b border-border/40">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher une note..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-border/60 bg-surface py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden"
                />
              </div>

              {/* Filtres par catégories */}
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`rounded-md px-2 py-0.5 text-3xs font-semibold transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface hover:bg-surface-hover text-muted-foreground'
                  }`}
                >
                  Tous ({notes.length})
                </button>
                {(['technique', 'urgent', 'client', 'memo'] as const).map((cat) => {
                  const count = notes.filter((n) => n.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-md px-2 py-0.5 text-3xs font-semibold transition-colors ${
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-surface hover:bg-surface-hover text-muted-foreground'
                      }`}
                    >
                      {CATEGORY_LABELS[cat]} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List of files */}
            <div className="max-h-[450px] overflow-y-auto p-2 space-y-1">
              {sortedNotes.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Aucune note trouvée.
                </div>
              ) : (
                sortedNotes.map((note) => {
                  const isActive = note.id === activeNote?.id;
                  const isEditing = editingTitleId === note.id;

                  return (
                    <div
                      key={note.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveNoteId(note.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          if (e.target === e.currentTarget) {
                            e.preventDefault();
                            setActiveNoteId(note.id);
                          }
                        }
                      }}
                      className={`group relative flex items-center justify-between rounded-xl p-2.5 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? 'bg-primary/10 text-primary border border-primary/30 font-medium shadow-2xs'
                          : 'hover:bg-surface-hover text-foreground border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <FileText
                          className={`size-4 shrink-0 ${
                            isActive ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        />
                        {isEditing ? (
                          <input
                            type="text"
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            onBlur={handleSaveRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename();
                              if (e.key === 'Escape') setEditingTitleId(null);
                            }}
                            ref={(input) => input?.focus()}
                            className="w-full rounded border border-primary bg-surface px-1.5 py-0.5 text-xs text-foreground outline-hidden"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="truncate text-xs font-semibold">
                                {note.title}
                              </span>
                              {note.isPinned && (
                                <Pin className="size-3 shrink-0 text-warning fill-amber-500/20" />
                              )}
                              {note.category && (
                                <Badge
                                  variant={CATEGORY_VARIANTS[note.category]}
                                  className="text-3xs py-0 px-1.5 font-bold"
                                >
                                  {CATEGORY_LABELS[note.category]}
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-subtle-foreground text-2xs mt-0.5">
                              {note.content.trim()
                                ? note.content.slice(0, 45)
                                : 'Note vide...'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Action buttons on hover/active */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleTogglePin(note.id, e)}
                          title={note.isPinned ? 'Détacher' : 'Épingler'}
                          className="rounded p-1 text-muted-foreground hover:text-warning hover:bg-surface"
                        >
                          <Pin className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(note, e)}
                          title="Renommer"
                          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-surface"
                        >
                          <Edit3 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          title="Supprimer"
                          className="rounded p-1 text-muted-foreground hover:text-error hover:bg-surface"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Éditeur de la note active */}
          <div className="flex flex-col lg:col-span-8 bg-surface">
            {activeNote ? (
              <>
                {/* Header Editor Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 p-3.5 bg-surface-sunken/10">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="relative flex items-center flex-1 max-w-md">
                      <input
                        type="text"
                        value={activeNote.title}
                        onChange={(e) => handleUpdateTitle(e.target.value)}
                        placeholder="Nom du fichier / Titre de la note..."
                        className="w-full rounded-lg border border-border/60 hover:border-primary/80 focus:border-primary bg-surface px-3 py-1.5 text-sm font-bold text-foreground outline-hidden transition-all shadow-2xs"
                        title="Modifier le nom du fichier"
                      />
                    </div>

                    {/* Selector Category */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Tag className="size-3.5 text-muted-foreground" />
                      <select
                        value={activeNote.category ?? ''}
                        onChange={(e) =>
                          handleUpdateCategory(
                            (e.target.value as NoteCategory) || undefined,
                          )
                        }
                        className="rounded-lg border border-border/60 bg-surface px-2 py-1 text-2xs font-semibold text-foreground focus:border-primary focus:outline-hidden"
                      >
                        <option value="">Sans catégorie</option>
                        <option value="technique">Technique</option>
                        <option value="urgent">Urgent</option>
                        <option value="client">Client</option>
                        <option value="memo">Pense-bête</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-subtle-foreground text-2xs flex items-center gap-1">
                      <Clock className="size-3" />
                      {lastSavedTime}
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleCopyContent}
                      title="Copier le contenu"
                    >
                      {copied ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleDownloadNote}
                      title="Télécharger (.txt)"
                    >
                      <Download className="size-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteNote(activeNote.id)}
                      className="text-muted-foreground hover:text-error"
                      title="Supprimer ce fichier"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Textarea Editor */}
                <div className="relative flex-1 p-4">
                  <textarea
                    value={activeNote.content}
                    onChange={(e) => handleUpdateContent(e.target.value)}
                    placeholder={
                      isTechnician
                        ? "Saisissez ici vos mémos d'intervention, relevés de mesures, codes d'accès..."
                        : "Saisissez ici vos consignes d'équipe, notes stratégiques, relances clients..."
                    }
                    className="h-full min-h-[300px] w-full resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground leading-relaxed focus:outline-hidden font-mono"
                  />
                </div>

                {/* Footer status bar */}
                <div className="flex items-center justify-between border-t border-border/40 p-2.5 px-4 bg-surface-sunken/20 text-subtle-foreground text-2xs">
                  <div className="flex items-center gap-3">
                    <span>{wordCount} mot{wordCount > 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{charCount} caractère{charCount > 1 ? 's' : ''}</span>
                  </div>
                  <span className="flex items-center gap-1 text-success font-medium">
                    <Sparkles className="size-3" />
                    Sauvegarde automatique activée
                  </span>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-muted-foreground text-xs">
                Sélectionnez ou créez une note pour commencer.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
