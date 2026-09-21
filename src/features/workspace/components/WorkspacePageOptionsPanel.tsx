import {
  Archive,
  Clipboard,
  Copy,
  Download,
  FileClock,
  FileInput,
  Link2,
  Move,
  Palette,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/lib/cn';
import type { WorkspacePage } from '../api/workspace.api';

type Action = {
  id: string;
  label: string;
  icon: typeof Copy;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
};

export function WorkspacePageOptionsPanel({
  page,
  canEdit,
  onClose,
  onPresentationChange,
  onCopyLink,
  onCopyContent,
  onDuplicate,
  onMove,
  onArchive,
  onImport,
  onExport,
  onHistory,
}: {
  page: WorkspacePage;
  canEdit: boolean;
  onClose: () => void;
  onPresentationChange: (
    patch: Partial<Pick<WorkspacePage, 'font_family' | 'small_text' | 'full_width' | 'locked'>>,
  ) => void;
  onCopyLink: () => void;
  onCopyContent: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onArchive: () => void;
  onImport: () => void;
  onExport: () => void;
  onHistory: () => void;
}) {
  const [query, setQuery] = useState('');
  const actions = useMemo<Action[]>(
    () => [
      { id: 'link', label: 'Copier le lien', icon: Link2, onClick: onCopyLink },
      {
        id: 'content',
        label: 'Copier le contenu de la page',
        icon: Clipboard,
        onClick: onCopyContent,
      },
      { id: 'duplicate', label: 'Dupliquer', icon: Copy, onClick: onDuplicate, hidden: !canEdit },
      { id: 'move', label: 'Déplacer', icon: Move, onClick: onMove, hidden: !canEdit },
      {
        id: 'import',
        label: 'Importer du texte',
        icon: FileInput,
        onClick: onImport,
        hidden: !canEdit || page.locked,
      },
      { id: 'export', label: 'Exporter en Markdown', icon: Download, onClick: onExport },
      { id: 'history', label: 'Historique des versions', icon: FileClock, onClick: onHistory },
      {
        id: 'archive',
        label: 'Déplacer dans la corbeille',
        icon: Archive,
        onClick: onArchive,
        danger: true,
        hidden: !canEdit,
      },
    ],
    [
      canEdit,
      onArchive,
      onCopyContent,
      onCopyLink,
      onDuplicate,
      onExport,
      onHistory,
      onImport,
      onMove,
      page.locked,
    ],
  );
  const visible = actions.filter(
    (action) =>
      !action.hidden &&
      action.label.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')),
  );

  return (
    <>
      <button
        type="button"
        aria-label="Fermer les options"
        className="fixed inset-0 z-40 cursor-default bg-black/5"
        onClick={onClose}
      />
      <aside className="bg-surface-raised border-border shadow-overlay fixed top-16 right-4 z-50 flex max-h-[calc(100dvh-5rem)] w-[min(21rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border">
        <div className="border-border flex items-center gap-2 border-b p-3">
          <Input
            aria-label="Rechercher des actions"
            placeholder="Rechercher des actions…"
            leadingIcon={<Search />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="hover:bg-surface-hover flex size-9 shrink-0 items-center justify-center rounded-lg"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-3">
          {query === '' ? (
            <section className="mb-3">
              <p className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-bold">
                <Palette className="size-3.5" />
                Style de la page
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['sans', 'Ag', 'Par défaut'],
                    ['serif', 'Ag', 'Sérif'],
                    ['mono', 'Ag', 'Chasse fixe'],
                  ] as const
                ).map(([value, glyph, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => onPresentationChange({ font_family: value })}
                    className={cn(
                      'hover:bg-surface-hover rounded-lg border px-1 py-2 text-center transition',
                      page.font_family === value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-transparent',
                      value === 'serif' && 'font-serif',
                      value === 'mono' && 'font-mono',
                    )}
                  >
                    <span className="block text-2xl">{glyph}</span>
                    <span className="text-muted-foreground text-2xs">{label}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="space-y-0.5">
            {visible.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
                className={cn(
                  'hover:bg-surface-hover flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm transition',
                  action.danger && 'text-error',
                )}
              >
                <action.icon className="size-4 shrink-0" aria-hidden />
                {action.label}
              </button>
            ))}
          </div>

          {query === '' ? (
            <section className="border-border mt-3 space-y-4 border-t pt-4">
              <Switch
                label="Texte de petite taille"
                checked={page.small_text}
                disabled={!canEdit}
                onCheckedChange={(checked) => onPresentationChange({ small_text: checked })}
              />
              <Switch
                label="Pleine largeur"
                checked={page.full_width}
                disabled={!canEdit}
                onCheckedChange={(checked) => onPresentationChange({ full_width: checked })}
              />
              <Switch
                label="Verrouiller la page"
                description="Empêche les modifications accidentelles."
                checked={page.locked}
                disabled={!canEdit}
                onCheckedChange={(checked) => onPresentationChange({ locked: checked })}
              />
            </section>
          ) : null}
          {visible.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Aucune action trouvée.</p>
          ) : null}
        </div>
      </aside>
    </>
  );
}
