import {
  Wrench,
  MapPin,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { TechnicianLocation } from '../types';

interface DispatchSidebarProps {
  technicians: TechnicianLocation[];
  selectedTechId: string | null;
  onSelectTech: (id: string) => void;
}

export function DispatchSidebar({
  technicians,
  selectedTechId,
  onSelectTech,
}: DispatchSidebarProps) {
  const activeTechCount = technicians.filter((t) => t.status !== 'offline').length;
  const inMissionCount = technicians.filter(
    (t) => t.status === 'on_road' || t.status === 'on_site',
  ).length;

  return (
    <aside className="flex flex-col h-full bg-surface rounded-2xl border border-border shadow-xs overflow-hidden">
      {/* 1. Header Simple & Épuré */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-surface-subtle/30">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Techniciens
        </h3>
        <span className="text-3xs text-muted-foreground/80 font-medium">il y a 0s</span>
      </div>

      {/* 2. Liste des Techniciens (Propre, Aérée, Sans Surcharge) */}
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2">
        {technicians.map((tech) => {
          const isSelected = selectedTechId === tech.id;
          return (
            <button
              key={tech.id}
              type="button"
              onClick={() => onSelectTech(tech.id)}
              className={cn(
                'w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 group focus:outline-hidden min-h-touch',
                isSelected
                  ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40'
                  : 'bg-surface hover:border-border-strong hover:bg-surface-hover/50 border-border/70',
              )}
            >
              {/* Avatar avec initiale */}
              <div className="relative shrink-0">
                <div
                  className={cn(
                    'size-9 rounded-full flex items-center justify-center font-bold text-xs transition-transform group-hover:scale-105',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-primary/15 text-primary',
                  )}
                >
                  {tech.initials}
                </div>
              </div>

              {/* Infos Technicien & Métier */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-xs font-bold text-foreground truncate">{tech.name}</h4>
                  <Badge
                    variant={
                      tech.status === 'on_road'
                        ? 'primary'
                        : tech.status === 'on_site'
                          ? 'success'
                          : 'outline'
                    }
                    className="text-3xs px-1.5 py-0.5 shrink-0"
                  >
                    {tech.status === 'on_road'
                      ? 'En route'
                      : tech.status === 'on_site'
                        ? 'Sur site'
                        : 'Disponible'}
                  </Badge>
                </div>

                {tech.currentMission ? (
                  <p className="text-3xs font-semibold text-primary flex items-center gap-1 mt-0.5 truncate">
                    <Wrench className="size-3 shrink-0" />
                    <span className="truncate">{tech.currentMission.title}</span>
                  </p>
                ) : (
                  <p className="text-3xs text-muted-foreground mt-0.5">Aucune mission assignée</p>
                )}

                <p className="text-3xs text-muted-foreground/80 flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="size-2.5 shrink-0 opacity-70" />
                  {tech.currentMission ? tech.currentMission.clientAddress : 'Position GPS active'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Bandeau KPI Simplifié (Total / Localisés / En mission) */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border/80 bg-surface-subtle/40 py-2.5 text-center mt-auto">
        <div>
          <p className="text-sm sm:text-base font-extrabold text-foreground leading-none">
            {technicians.length}
          </p>
          <p className="text-3xs text-muted-foreground mt-1 font-medium">Total</p>
        </div>
        <div>
          <p className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 leading-none">
            {activeTechCount}
          </p>
          <p className="text-3xs text-muted-foreground mt-1 font-medium">Localisés</p>
        </div>
        <div>
          <p className="text-sm sm:text-base font-extrabold text-primary leading-none">
            {inMissionCount}
          </p>
          <p className="text-3xs text-muted-foreground mt-1 font-medium">En mission</p>
        </div>
      </div>
    </aside>
  );
}
