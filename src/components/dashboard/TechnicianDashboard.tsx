import { ClipboardList, Wrench, User, Calendar, MapPin, Zap, Cable, Network, Cpu, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { useCurrentOrganization } from '@/features/organizations';
import { useMissions, MissionStatusBadge } from '@/features/missions';

export function TechnicianDashboard() {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const missions = useMissions(organizationId, { limit: 5 });
  const myMissions = missions.data ?? [];

  return (
    <div className="space-y-8 pb-12">
      {/* Header Technicien */}
      <div className="border-b border-slate-800/60 pb-5">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
            Espace Technicien Terrain
          </span>
          {organization ? <span className="text-xs text-slate-400">• {organization.name}</span> : null}
        </div>
        <h1 className="mt-1.5 text-2xl font-bold text-slate-100">
          Bonjour, {user?.email?.split('@')[0] ?? 'Technicien'} 👋
        </h1>
        <p className="text-xs text-slate-400">
          Retrouvez vos interventions confiées et accédez directement à vos outils de calcul.
        </p>
      </div>

      {/* 1. Mes Missions du Jour */}
      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <ClipboardList className="size-4 text-blue-400" />
            Mes Missions & Interventions confiées
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to={ROUTES.missions}>
              Voir toutes mes missions
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {myMissions.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <Calendar className="size-8 text-slate-500 mx-auto" />
              <p className="text-xs text-slate-300 font-medium">Aucune intervention planifiée pour le moment.</p>
              <p className="text-2xs text-slate-400">Vos prochaines missions attribuées par votre responsable apparaîtront ici.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/60">
              {myMissions.map((mission) => (
                <li key={mission.id} className="py-3">
                  <Link to={ROUTES.mission(mission.id)} className="block group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{mission.reference}</Badge>
                        <span className="text-sm font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                          {mission.title}
                        </span>
                      </div>
                      <MissionStatusBadge status={mission.status} />
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      {mission.customer_name ? <span>Client: <strong>{mission.customer_name}</strong></span> : null}
                      {mission.city ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3 text-blue-400" />
                          {mission.city}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 2. Accès Rapide aux Outils Techniques */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Wrench className="size-4 text-emerald-400" />
          Mes Outils Techniques du Terrain
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to={`${ROUTES.tools}?cat=fibre`}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-center hover:border-blue-500/50 hover:bg-slate-900 transition-all group"
          >
            <Cable className="size-6 text-blue-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-semibold text-slate-200">Fibre Optique</span>
            <span className="text-2xs text-slate-400 mt-0.5">Couleurs, dBm/mW, OTDR</span>
          </Link>

          <Link
            to={`${ROUTES.tools}?cat=electricite`}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-center hover:border-amber-500/50 hover:bg-slate-900 transition-all group"
          >
            <Zap className="size-6 text-amber-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-semibold text-slate-200">Électricité</span>
            <span className="text-2xs text-slate-400 mt-0.5">Loi d'Ohm, Tension, Section</span>
          </Link>

          <Link
            to={`${ROUTES.tools}?cat=telecoms`}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-center hover:border-cyan-500/50 hover:bg-slate-900 transition-all group"
          >
            <Network className="size-6 text-cyan-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-semibold text-slate-200">Télécoms & Radio</span>
            <span className="text-2xs text-slate-400 mt-0.5">FSPL, ROS, Fresnel, Atténuateurs</span>
          </Link>

          <Link
            to={`${ROUTES.tools}?cat=reseaux`}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-center hover:border-emerald-500/50 hover:bg-slate-900 transition-all group"
          >
            <Cpu className="size-6 text-emerald-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-semibold text-slate-200">Réseaux & IT</span>
            <span className="text-2xs text-slate-400 mt-0.5">IPv4, Subnetting, VLSM</span>
          </Link>
        </div>
      </div>

      {/* 3. Accès Profil */}
      <Card className="border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
              <User className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Mon Compte Technicien</p>
              <p className="text-2xs text-slate-400">{user?.email}</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.profile}>Mon Profil</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
