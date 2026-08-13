import { Calendar, ChevronRight, Clock, Filter, MapPin, MoreVertical } from 'lucide-react';
import { Link } from 'react-router';

import { ROUTES } from '@/config/routes';

export interface InterventionItem {
  id: string;
  time: string;
  client: string;
  type: string;
  technician: {
    name: string;
    avatar: string;
  };
  location: string;
  status: 'in_progress' | 'planned' | 'pending' | 'urgent' | 'completed';
}

const DEFAULT_INTERVENTIONS: InterventionItem[] = [
  {
    id: 'INT-8902',
    time: '08:30 - 10:30',
    client: 'Thales DataCenter',
    type: 'Maintenance Fibre Optique',
    technician: {
      name: 'Jean Dupont',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    },
    location: 'Paris Nord (75017)',
    status: 'in_progress',
  },
  {
    id: 'INT-8903',
    time: '10:00 - 12:00',
    client: "Clinique Val d'Or",
    type: 'Audit Réseau IT & Sécurité',
    technician: {
      name: 'Marc Antoine',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    },
    location: 'Neuilly-sur-Seine (92200)',
    status: 'urgent',
  },
  {
    id: 'INT-8904',
    time: '13:30 - 15:30',
    client: 'BNP Paribas - Siège',
    type: 'Remplacement Switch Cœur',
    technician: {
      name: 'Sophie Martin',
      avatar:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    },
    location: 'La Défense (92800)',
    status: 'planned',
  },
  {
    id: 'INT-8905',
    time: '14:00 - 16:00',
    client: 'Logistics Hub',
    type: 'Installation Bornes Wi-Fi 6',
    technician: {
      name: 'Thomas Bernard',
      avatar:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    },
    location: 'Roissy-en-France (95700)',
    status: 'pending',
  },
  {
    id: 'INT-8901',
    time: '07:00 - 08:15',
    client: 'TechCorp HQ',
    type: 'Dépannage Routeur 5G',
    technician: {
      name: 'Jean Dupont',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    },
    location: 'Boulogne-Billancourt',
    status: 'completed',
  },
];

export function DailyPlanningSection({
  interventions = DEFAULT_INTERVENTIONS,
}: {
  interventions?: InterventionItem[];
}) {
  const renderStatusBadge = (status: InterventionItem['status']) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/60 dark:text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            En cours
          </span>
        );
      case 'planned':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/60 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/60 dark:text-blue-300">
            <span className="size-1.5 rounded-full bg-blue-500" />
            Planifiée
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/60 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/60 dark:text-amber-300">
            <span className="size-1.5 rounded-full bg-amber-500" />
            En attente
          </span>
        );
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/60 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/60 dark:text-rose-300">
            <span className="size-1.5 rounded-full bg-rose-500 animate-ping" />
            Urgente
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <span className="size-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
            Terminée
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <Calendar className="size-5 text-blue-600 dark:text-blue-400" />
            Interventions du jour
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Planning et statuts en temps réel
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Filtrer"
          >
            <Filter className="size-4" />
          </button>
          <Link
            to={ROUTES.missions}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            Voir tout
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-xs dark:divide-slate-800/60 dark:border-slate-800/80 dark:bg-slate-900">
        {interventions.map((item) => (
          <div
            key={item.id}
            className="group flex flex-col justify-between gap-4 p-4 transition-colors hover:bg-slate-50/80 sm:flex-row sm:items-center sm:p-5 dark:hover:bg-slate-800/40"
          >
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">
                  {item.id}
                </span>
                {renderStatusBadge(item.status)}
              </div>

              <h3 className="text-base font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                {item.type}
              </h3>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {item.client}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5 text-muted-foreground" />
                  {item.time}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  {item.location}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2 sm:justify-end sm:border-t-0 sm:pt-0 dark:border-slate-800/40">
              <div className="flex items-center gap-2.5">
                <img
                  src={item.technician.avatar}
                  alt={item.technician.name}
                  className="size-8 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800"
                />
                <div className="text-left sm:text-right">
                  <div className="text-xs font-medium text-slate-900 dark:text-slate-200">
                    {item.technician.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Technicien</div>
                </div>
              </div>

              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <MoreVertical className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
