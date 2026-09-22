import {
  Archive,
  Bell,
  Blocks,
  BookOpen,
  Bot,
  Clipboard,
  Copy,
  Download,
  FileClock,
  FileInput,
  Languages,
  Link2,
  Move,
  Palette,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/lib/cn';
import type { WorkspacePage, WorkspacePagePreference } from '../api/workspace.api';

type ActionGroup = 'essentials' | 'assist' | 'transfer' | 'page';

type Action = {
  id: string;
  label: string;
  icon: typeof Copy;
  group: ActionGroup;
  onClick: () => void;
  keywords?: string;
  status?: string;
  shortcut?: string;
  danger?: boolean;
  hidden?: boolean;
};

const GROUP_LABELS: Record<ActionGroup, string> = {
  essentials: 'Actions',
  assist: 'Enrichir',
  transfer: 'Importer et exporter',
  page: 'Gestion de la page',
};

const NOTIFICATION_LABELS: Record<WorkspacePagePreference['notification_level'], string> = {
  off: 'Désactivées',
  mentions: 'Mentions',
  all: 'Toutes',
};

export function WorkspacePageOptionsPanel({
  page,
  canEdit,
  canAi,
  notificationLevel,
  connectionCount,
  onClose,
  onPresentationChange,
  onCopyLink,
  onCopyContent,
  onDuplicate,
  onMove,
  onArchive,
  onCustomize,
  onUseAi,
  onTranslate,
  onImport,
  onExport,
  onToggleWiki,
  onHistory,
  onNotifications,
  onConnections,
}: {
  page: WorkspacePage;
  canEdit: boolean;
  canAi: boolean;
  notificationLevel: WorkspacePagePreference['notification_level'];
  connectionCount: number;
  onClose: () => void;
  onPresentationChange: (
    patch: Partial<
      Pick<
        WorkspacePage,
        'font_family' | 'small_text' | 'full_width' | 'locked' | 'accent_color' | 'wiki_mode'
      >
    >,
  ) => void;
  onCopyLink: () => void;
  onCopyContent: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onArchive: () => void;
  onCustomize: () => void;
  onUseAi: () => void;
  onTranslate: () => void;
  onImport: () => void;
  onExport: () => void;
  onToggleWiki: () => void;
  onHistory: () => void;
  onNotifications: () => void;
  onConnections: () => void;
}) {
  const [query, setQuery] = useState('');
  const actions = useMemo<Action[]>(
    () => [
      {
        id: 'link',
        label: 'Copier le lien',
        icon: Link2,
        group: 'essentials',
        shortcut: 'Ctrl+Alt+L',
        onClick: onCopyLink,
      },
      {
        id: 'content',
        label: 'Copier le contenu de la page',
        icon: Clipboard,
        group: 'essentials',
        onClick: onCopyContent,
      },
      {
        id: 'duplicate',
        label: 'Dupliquer',
        icon: Copy,
        group: 'essentials',
        shortcut: 'Ctrl+D',
        onClick: onDuplicate,
        hidden: !canEdit,
      },
      {
        id: 'move',
        label: 'Déplacer',
        icon: Move,
        group: 'essentials',
        onClick: onMove,
        hidden: !canEdit,
      },
      {
        id: 'customize',
        label: 'Personnaliser la page',
        icon: SlidersHorizontal,
        group: 'assist',
        keywords: 'couleur couverture icône apparence',
        onClick: onCustomize,
        hidden: !canEdit,
      },
      {
        id: 'ai',
        label: "Utiliser avec l'IA",
        icon: Bot,
        group: 'assist',
        keywords: 'assistant résumé rédaction',
        onClick: onUseAi,
        hidden: !canAi,
      },
      {
        id: 'translate',
        label: 'Traduire',
        icon: Languages,
        group: 'assist',
        keywords: 'langue traduction',
        onClick: onTranslate,
        hidden: !canAi,
      },
      {
        id: 'import',
        label: 'Importer du texte',
        icon: FileInput,
        group: 'transfer',
        keywords: 'markdown fichier',
        onClick: onImport,
        hidden: !canEdit || page.locked,
      },
      {
        id: 'export',
        label: 'Exporter',
        icon: Download,
        group: 'transfer',
        keywords: 'markdown texte html pdf impression',
        onClick: onExport,
      },
      {
        id: 'wiki',
        label: page.wiki_mode ? 'Quitter le mode wiki' : 'Convertir en wiki',
        icon: BookOpen,
        group: 'page',
        ...(page.wiki_mode ? { status: 'Activé' } : {}),
        keywords: 'base de connaissances articles',
        onClick: onToggleWiki,
        hidden: !canEdit,
      },
      {
        id: 'history',
        label: 'Historique des versions',
        icon: FileClock,
        group: 'page',
        keywords: 'dernières modifications activité',
        onClick: onHistory,
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        group: 'page',
        status: NOTIFICATION_LABELS[notificationLevel],
        keywords: 'mentions suivi alertes',
        onClick: onNotifications,
      },
      {
        id: 'connections',
        label: 'Connexions',
        icon: Blocks,
        group: 'page',
        status: connectionCount > 0 ? String(connectionCount) : 'Aucune',
        keywords: 'tâches missions liens',
        onClick: onConnections,
      },
      {
        id: 'archive',
        label: 'Déplacer dans la corbeille',
        icon: Archive,
        group: 'page',
        onClick: onArchive,
        danger: true,
        hidden: !canEdit,
      },
    ],
    [
      canAi,
      canEdit,
      connectionCount,
      notificationLevel,
      onArchive,
      onConnections,
      onCopyContent,
      onCopyLink,
      onCustomize,
      onDuplicate,
      onExport,
      onHistory,
      onImport,
      onMove,
      onNotifications,
      onToggleWiki,
      onTranslate,
      onUseAi,
      page.locked,
      page.wiki_mode,
    ],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase('fr');
  const visible = actions.filter((action) => {
    if (action.hidden) return false;
    if (normalizedQuery === '') return true;
    return `${action.label} ${action.keywords ?? ''} ${action.status ?? ''}`
      .toLocaleLowerCase('fr')
      .includes(normalizedQuery);
  });

  return (
    <>
      <button
        type="button"
        aria-label="Fermer les options"
        className="fixed inset-0 z-40 cursor-default bg-black/5 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside className="bg-surface-raised border-border shadow-overlay fixed right-3 bottom-3 left-3 z-50 flex max-h-[min(42rem,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-2xl border sm:top-16 sm:right-4 sm:bottom-auto sm:left-auto sm:w-[21rem]">
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
          {normalizedQuery === '' ? (
            <section className="mb-3">
              <p className="text-muted-foreground mb-2 flex items-center gap-2 px-1 text-xs font-bold">
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

          {(['essentials', 'assist', 'transfer', 'page'] as const).map((group) => {
            const groupActions = visible.filter((action) => action.group === group);
            if (groupActions.length === 0) return null;
            return (
              <section key={group} className="border-border border-t py-2 first:border-t-0">
                <p className="text-muted-foreground text-2xs px-2.5 py-1 font-bold tracking-wide uppercase">
                  {GROUP_LABELS[group]}
                </p>
                {groupActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    aria-label={action.label}
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
                    <span className="min-w-0 flex-1 truncate">{action.label}</span>
                    {action.status ? (
                      <span className="text-muted-foreground text-xs">{action.status}</span>
                    ) : null}
                    {action.shortcut ? (
                      <kbd className="text-muted-foreground text-2xs hidden sm:inline">
                        {action.shortcut}
                      </kbd>
                    ) : null}
                  </button>
                ))}
              </section>
            );
          })}

          {normalizedQuery === '' ? (
            <section className="border-border space-y-4 border-t px-2 pt-4 pb-2">
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
