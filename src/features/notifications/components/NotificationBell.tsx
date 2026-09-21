import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  MessageSquare,
  Package,
  Palmtree,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { Popover } from 'radix-ui';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
      return <Palmtree className="text-warning size-4" />;
    case 'stock':
      return <Package className="text-error size-4" />;
    case 'equipment':
      return <Wrench className="text-accent size-4" />;
    case 'client':
      return <MessageSquare className="text-info size-4" />;
    case 'mission':
    default:
      return <ClipboardList className="text-primary size-4" />;
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();

  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification } =
    useNotifications();

  const displayedNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const handleNotificationClick = (notification: AppNotification) => {
    markAsRead(notification.id);
    setIsOpen(false);
    void navigate(notification.link);
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      {/* Bouton Déclencheur Cloche */}
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Notifications d'activité${unreadCount > 0 ? `, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : ''}`}
          className={cn(
            'size-touch relative flex cursor-pointer items-center justify-center rounded-lg transition-all sm:size-9',
            'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
            isOpen
              ? 'bg-surface-hover text-primary ring-primary/20 ring-2'
              : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
          )}
        >
          <Bell className="size-4.5 sm:size-5" aria-hidden="true" />

          {unreadCount > 0 ? (
            <span
              className="bg-primary text-primary-foreground text-3xs absolute -top-1 -right-1 z-10 flex size-5 items-center justify-center rounded-full font-extrabold shadow-xs"
              aria-hidden="true"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>

      {/* Popover Panneau des Notifications */}
      <Popover.Portal>
        <Popover.Content
          aria-label="Centre de notifications"
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={12}
          className="border-border bg-surface shadow-overlay data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-2 z-50 flex max-h-[calc(100dvh-5rem)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border duration-150 sm:w-96"
        >
          {/* Header */}
          <div className="border-border bg-surface-sunken/40 flex items-center justify-between border-b p-3.5">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="text-foreground flex items-center gap-1.5 text-xs font-bold">
                <Bell className="text-primary size-4" aria-hidden="true" />
                <span>Notifications</span>
              </h3>
              {unreadCount > 0 && (
                <Badge variant="primary" className="text-3xs py-0.2 px-1.5 font-bold">
                  {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-primary hover:bg-primary/10 text-3xs px-2 font-semibold"
                  leadingIcon={<CheckCheck className="size-3.5" aria-hidden="true" />}
                >
                  <span className="xs:inline hidden">Tout marquer lu</span>
                  <span className="xs:hidden sr-only">Tout marquer comme lu</span>
                </Button>
              )}
              <Popover.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Fermer les notifications">
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </Popover.Close>
            </div>
          </div>

          {/* Onglets Filtres */}
          <div
            role="group"
            aria-label="Filtrer les notifications"
            className="border-border/60 bg-surface flex items-center gap-1 border-b p-2"
          >
            <button
              type="button"
              onClick={() => setFilter('all')}
              aria-pressed={filter === 'all'}
              className={cn(
                'min-h-touch text-2xs cursor-pointer rounded-lg px-3 font-semibold transition-colors sm:min-h-0 sm:py-1.5',
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
              aria-pressed={filter === 'unread'}
              className={cn(
                'min-h-touch text-2xs cursor-pointer rounded-lg px-3 font-semibold transition-colors sm:min-h-0 sm:py-1.5',
                filter === 'unread'
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
              )}
            >
              Non lues ({unreadCount})
            </button>
          </div>

          {/* Liste des Notifications */}
          <div className="divide-border/50 max-h-[380px] min-h-0 flex-1 scrollbar-thin divide-y overflow-y-auto">
            {displayedNotifications.length === 0 ? (
              <div className="space-y-2 p-8 text-center">
                <CheckCircle2 className="text-success/60 mx-auto size-8" aria-hidden="true" />
                <p className="text-foreground text-xs font-bold">
                  {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
                </p>
                <p className="text-3xs text-muted-foreground">
                  Vous êtes à jour dans vos missions et validations !
                </p>
              </div>
            ) : (
              displayedNotifications.map((n) => {
                const relativeTime = formatRelativeTime(n.timestamp);

                return (
                  <div
                    key={n.id}
                    className={cn(
                      'group hover:bg-surface-hover relative flex items-stretch transition-colors',
                      !n.read && 'bg-primary/5 dark:bg-primary/10',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className="focus-visible:ring-ring flex min-w-0 flex-1 cursor-pointer items-start gap-3 p-3.5 text-left focus-visible:ring-2 focus-visible:outline-none"
                      aria-label={`${n.title}. ${n.description}${relativeTime ? `. ${relativeTime}` : ''}`}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border',
                          n.category === 'hr' && 'border-warning/20 bg-warning/10',
                          n.category === 'stock' && 'border-error/20 bg-error/10',
                          n.category === 'equipment' && 'border-accent/20 bg-accent/10',
                          n.category === 'mission' && 'border-primary/20 bg-primary/10',
                          n.category === 'client' && 'border-info/20 bg-info/10',
                        )}
                        aria-hidden="true"
                      >
                        {getNotificationIcon(n)}
                      </span>

                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              'truncate text-xs',
                              !n.read
                                ? 'text-foreground font-bold'
                                : 'text-foreground/85 font-semibold',
                            )}
                          >
                            {n.title}
                          </span>
                          <span className="text-3xs text-muted-foreground shrink-0 font-medium">
                            {relativeTime}
                          </span>
                        </span>
                        <span className="text-2xs text-muted-foreground line-clamp-2 block leading-relaxed">
                          {n.description}
                        </span>
                      </span>
                    </button>

                    <div className="flex shrink-0 flex-col items-center justify-between py-2.5 pr-2">
                      {!n.read ? (
                        <span
                          className="bg-primary size-2 shrink-0 rounded-full"
                          aria-hidden="true"
                        />
                      ) : (
                        <span aria-hidden="true" />
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => dismissNotification(n.id)}
                        aria-label={`Masquer la notification « ${n.title} »`}
                        className="text-muted-foreground hover:text-error sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Popover */}
          <div className="border-border bg-surface-sunken/30 text-3xs text-muted-foreground flex items-center justify-between border-t p-2.5">
            <span>Centre d&apos;alertes REZO360</span>
            <Link
              to={ROUTES.planning}
              onClick={() => setIsOpen(false)}
              className="text-primary flex items-center gap-1 font-semibold hover:underline"
            >
              Voir le planning
              <ExternalLink className="size-2.5" aria-hidden="true" />
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
