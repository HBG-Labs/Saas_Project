import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Package,
  Palmtree,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

import { useNotifications } from '../hooks/useNotifications';
import type { AppNotification } from '../types/notifications.types';

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "À l'instant";
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `Il y a ${minutes} min`;
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `Il y a ${hours} h`;
    }
    if (diffInSeconds < 172800) return 'Hier';

    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

function getNotificationIcon(notification: AppNotification) {
  switch (notification.category) {
    case 'hr':
      return <Palmtree className="size-4 text-amber-500" />;
    case 'stock':
      return <Package className="size-4 text-rose-500" />;
    case 'equipment':
      return <Wrench className="size-4 text-purple-500" />;
    case 'mission':
    default:
      return <ClipboardList className="size-4 text-primary" />;
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
  } = useNotifications();

  // Fermer quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const displayedNotifications =
    filter === 'unread'
      ? notifications.filter((n) => !n.read)
      : notifications;

  const handleNotificationClick = (notification: AppNotification) => {
    markAsRead(notification.id);
    setIsOpen(false);
    void navigate(notification.link);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Bouton Déclencheur Cloche */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notifications d'activité"
        aria-expanded={isOpen}
        className={cn(
          'relative flex size-touch sm:size-9 items-center justify-center rounded-lg transition-all cursor-pointer',
          isOpen
            ? 'bg-surface-hover text-primary ring-2 ring-primary/20'
            : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
        )}
      >
        <Bell className="size-4.5 sm:size-5" />

        {/* Badge d'alertes non lues */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 sm:size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-extrabold text-primary-foreground shadow-xs animate-in zoom-in-50">
            {unreadCount > 9 ? '9+' : unreadCount}
            <span className="absolute -inset-0.5 rounded-full bg-primary/40 animate-ping" />
          </span>
        )}
      </button>

      {/* Popover Panneau des Notifications */}
      {isOpen && (
        <div
          className={cn(
            'absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 rounded-2xl border border-border bg-surface shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-border bg-surface-sunken/40">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Bell className="size-4 text-primary" />
                <span>Notifications</span>
              </h3>
              {unreadCount > 0 && (
                <Badge variant="primary" className="text-3xs font-bold px-1.5 py-0.2">
                  {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-3xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  title="Tout marquer comme lu"
                >
                  <CheckCheck className="size-3.5" />
                  <span>Tout marquer lu</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
                aria-label="Fermer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Onglets Filtres */}
          <div className="flex items-center gap-1 p-2 border-b border-border/60 bg-surface">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-2xs font-semibold transition-all cursor-pointer',
                filter === 'all'
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
              )}
            >
              Toutes ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-2xs font-semibold transition-all cursor-pointer',
                filter === 'unread'
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
              )}
            >
              Non lues ({unreadCount})
            </button>
          </div>

          {/* Liste des Notifications */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/50 scrollbar-thin">
            {displayedNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="size-8 text-emerald-500/60 mx-auto" />
                <p className="text-xs font-bold text-foreground">
                  {filter === 'unread'
                    ? 'Aucune notification non lue'
                    : 'Aucune notification'}
                </p>
                <p className="text-3xs text-muted-foreground">
                  Vous êtes à jour dans vos missions et validations !
                </p>
              </div>
            ) : (
              displayedNotifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'group relative p-3.5 flex items-start gap-3 transition-colors hover:bg-surface-hover cursor-pointer',
                    !n.read && 'bg-primary/5 dark:bg-primary/10',
                  )}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotificationClick(n)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNotificationClick(n);
                    }
                  }}
                >
                  {/* Icône de catégorie */}
                  <div
                    className={cn(
                      'size-8 rounded-xl flex items-center justify-center shrink-0 border mt-0.5',
                      n.category === 'hr' && 'bg-amber-500/10 border-amber-500/20',
                      n.category === 'stock' && 'bg-rose-500/10 border-rose-500/20',
                      n.category === 'equipment' && 'bg-purple-500/10 border-purple-500/20',
                      n.category === 'mission' && 'bg-primary/10 border-primary/20',
                    )}
                  >
                    {getNotificationIcon(n)}
                  </div>

                  {/* Contenu */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={cn(
                          'text-xs truncate',
                          !n.read ? 'font-bold text-foreground' : 'font-semibold text-foreground/85',
                        )}
                      >
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                        {formatRelativeTime(n.timestamp)}
                      </span>
                    </div>

                    <p className="text-2xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {n.description}
                    </p>
                  </div>

                  {/* Pastille non lu ou bouton dismiss */}
                  <div
                    role="presentation"
                    className="flex flex-col items-center justify-between self-stretch shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {!n.read && (
                      <span className="size-2 rounded-full bg-primary shrink-0" />
                    )}

                    <button
                      type="button"
                      onClick={() => dismissNotification(n.id)}
                      aria-label="Supprimer"
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-rose-500 transition-all rounded"
                      title="Masquer"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Popover */}
          <div className="p-2.5 border-t border-border bg-surface-sunken/30 flex items-center justify-between text-3xs text-muted-foreground">
            <span>Centre d&apos;alertes REZO360</span>
            <Link
              to={ROUTES.planning}
              onClick={() => setIsOpen(false)}
              className="text-primary font-semibold hover:underline flex items-center gap-1"
            >
              Voir le planning
              <ExternalLink className="size-2.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
