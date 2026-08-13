import { Users } from 'lucide-react';
import { Link } from 'react-router';

import { ROUTES } from '@/config/routes';

export interface TechnicianItem {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'in_progress' | 'available' | 'offline';
  currentTask?: string;
}

const DEFAULT_TECHNICIANS: TechnicianItem[] = [
  {
    id: 'tech-1',
    name: 'Jean Dupont',
    role: 'Expert Fibre Optique',
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    status: 'in_progress',
    currentTask: 'Thales DataCenter',
  },
  {
    id: 'tech-2',
    name: 'Sophie Martin',
    role: 'Ingénieure Réseaux & IT',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    status: 'available',
  },
  {
    id: 'tech-3',
    name: 'Marc Antoine',
    role: 'Spécialiste Télécoms',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    status: 'in_progress',
    currentTask: "Clinique Val d'Or",
  },
  {
    id: 'tech-4',
    name: 'Thomas Bernard',
    role: 'Technicien Électricité',
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    status: 'offline',
  },
];

export function ActiveTeamSection({
  technicians = DEFAULT_TECHNICIANS,
}: {
  technicians?: TechnicianItem[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <Users className="size-5 text-violet-600 dark:text-violet-400" />
          Équipe sur le terrain
        </h2>
        <Link
          to={ROUTES.teams}
          className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          Gérer l&apos;équipe
        </Link>
      </div>

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs dark:divide-slate-800/60 dark:border-slate-800/80 dark:bg-slate-900">
        {technicians.map((tech) => (
          <div key={tech.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={tech.avatar}
                  alt={tech.name}
                  className="size-9 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800"
                />
                <span
                  className={`absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                    tech.status === 'in_progress'
                      ? 'bg-emerald-500'
                      : tech.status === 'available'
                        ? 'bg-blue-500'
                        : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{tech.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tech.role}</p>
              </div>
            </div>

            <div className="text-right">
              {tech.status === 'in_progress' && (
                <div className="flex flex-col items-end">
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                    🟢 En intervention
                  </span>
                  {tech.currentTask && (
                    <span className="text-[10px] text-muted-foreground max-w-[120px] truncate">
                      {tech.currentTask}
                    </span>
                  )}
                </div>
              )}
              {tech.status === 'available' && (
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  🔵 Disponible
                </span>
              )}
              {tech.status === 'offline' && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400 dark:bg-slate-800">
                  ⚫ Hors-ligne
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
