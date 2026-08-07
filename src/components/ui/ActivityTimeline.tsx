import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';

export interface ActivityItem {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Date ISO 8601. */
  timestamp: string;
  href?: string;
}

export interface ActivityTimelineProps {
  items: readonly ActivityItem[];
  className?: string;
}

/**
 * Fil d'activité chronologique.
 *
 * Le trait vertical est décoratif (`aria-hidden`) : la structure de liste
 * suffit à un lecteur d'écran, et annoncer un élément graphique ajouterait du
 * bruit.
 */
export function ActivityTimeline({ items, className }: ActivityTimelineProps) {
  return (
    <ol className={cn('relative space-y-4', className)}>
      {items.map((item, index) => {
        const Icon = item.icon;
        const isLast = index === items.length - 1;

        return (
          <li key={item.id} className="relative flex gap-3">
            {!isLast ? (
              <span
                aria-hidden="true"
                className="bg-border absolute top-8 left-[15px] h-[calc(100%-1rem)] w-px"
              />
            ) : null}

            <span className="bg-surface-hover text-muted-foreground relative flex size-8 shrink-0 items-center justify-center rounded-full">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1 pt-1">
              <p className="text-foreground truncate text-sm font-medium">{item.title}</p>
              {item.description ? (
                <p className="text-muted-foreground truncate text-xs">{item.description}</p>
              ) : null}
              <time dateTime={item.timestamp} className="text-subtle-foreground text-2xs">
                {formatRelativeTime(item.timestamp)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
