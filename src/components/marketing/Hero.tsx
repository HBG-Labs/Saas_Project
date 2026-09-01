import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  ShieldCheck,
  Smartphone,
  Wrench,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { DownloadAppModal } from '@/components/layout/DownloadAppModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

/**
 * Bandeau d'accueil.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUI A CHANGÉ, ET POURQUOI
 *
 * 43 couleurs codées en dur, zéro jeton : ce composant supposait un fond noir
 * (`text-white`, `text-slate-300`, dégradés cyan) et ne pouvait donc suivre
 * aucun thème. Il est désormais entièrement sur jetons, comme le produit.
 *
 * Les trois appels à l'action étaient des liens texte, sans surface de bouton.
 * Sur la page dont le seul travail est de faire cliquer, rien n'indiquait où
 * cliquer. Ce sont maintenant un bouton plein, un bouton de contour et un lien
 * discret — une hiérarchie, pas trois liens de même poids.
 *
 * SUR LA MAQUETTE DE SUPERVISION CI-DESSOUS
 *
 * Ces chiffres sont fictifs et le resteront tant que la démonstration n'est pas
 * branchée sur un jeu de données réel. La mention « Exemple » est donc affichée
 * dans la maquette elle-même : une capture de produit qui se fait passer pour
 * des données réelles est une promesse qu'on ne tient pas.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const APERCU_KPIS = [
  { label: 'Missions', value: '24', sub: '+12 % cette semaine' },
  { label: 'Interventions', value: '18', sub: '56 % terminées' },
  { label: 'Techniciens', value: '14/16', sub: '87 % actifs' },
  { label: 'Rapports', value: '5', sub: '3 à valider' },
] as const;

const APERCU_PLANNING = [
  {
    id: 'INT-8902',
    statut: 'En cours',
    variant: 'success' as const,
    titre: 'Installation & mise en service CVC',
    client: 'Complexe Tertiaire Horizon',
    heure: '08:30 – 10:30',
    lieu: 'Paris Nord',
    tech: 'Jean Dupont',
  },
  {
    id: 'INT-8903',
    statut: 'Urgente',
    variant: 'warning' as const,
    titre: 'Audit technique & conformité fibre',
    client: 'Clinique Val d’Or',
    heure: '10:00 – 12:00',
    lieu: 'Lyon Centre',
    tech: 'Marc Antoine',
  },
] as const;

export function Hero() {
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  return (
    <section className="py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl lg:max-w-3xl">
          <Badge variant="primary" className="mb-5">
            <Zap className="size-3.5" aria-hidden="true" />
            Essai de 14 jours, sans carte bancaire
          </Badge>

          <h1 className="text-foreground text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Pilotez votre activité technique,{' '}
            <span className="text-primary">du devis au compte rendu signé.</span>
          </h1>

          <p className="text-muted-foreground mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
            Interventions, plannings, signatures clients, suivi de matériel et outils de calcul
            métier — sur une seule plateforme, utilisable depuis le terrain comme depuis le bureau.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link to={ROUTES.register}>
                Commencer gratuitement
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link to={ROUTES.tools}>
                <Wrench className="size-4" aria-hidden="true" />
                Explorer les outils
              </Link>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => setIsDownloadModalOpen(true)}
            >
              <Smartphone className="size-4" aria-hidden="true" />
              App terrain
            </Button>
          </div>

          <ul className="border-border text-muted-foreground mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-5 text-sm">
            <li className="flex items-center gap-2">
              <Wrench className="text-primary size-4 shrink-0" aria-hidden="true" />
              Outils &amp; calculs métiers
            </li>
            <li className="flex items-center gap-2">
              <Zap className="text-primary size-4 shrink-0" aria-hidden="true" />
              Suivi des interventions en direct
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="text-primary size-4 shrink-0" aria-hidden="true" />
              Hébergement européen, conforme RGPD
            </li>
          </ul>
        </div>

        <DownloadAppModal
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
        />

        {/* ---------------------------------------------------- APERÇU PRODUIT */}
        <div className="border-border bg-surface shadow-overlay mt-14 overflow-hidden rounded-2xl border sm:mt-20">
          <div className="border-border bg-surface-subtle flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="bg-success size-2 shrink-0 rounded-full" aria-hidden="true" />
              <span className="text-foreground text-sm font-semibold">Supervision en temps réel</span>
            </div>
            <Badge variant="outline">Exemple</Badge>
          </div>

          <div className="space-y-8 p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
              <div>
                <h2 className="text-foreground text-lg font-semibold">Bonjour, Alexandre</h2>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  Aperçu du jour · pilotage multi-chantiers
                </p>
              </div>
              <span className="text-muted-foreground text-sm">
                {new Date().toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              {APERCU_KPIS.map(({ label, value, sub }) => (
                <div key={label}>
                  <p className="text-muted-foreground text-sm">{label}</p>
                  <p className="text-foreground mt-1 text-3xl font-bold tracking-tight tabular-nums">
                    {value}
                  </p>
                  <p className="text-subtle-foreground mt-0.5 text-sm">{sub}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="border-border flex items-center justify-between border-b pb-2">
                <span className="text-foreground flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="text-primary size-4" aria-hidden="true" />
                  Planning du jour
                </span>
                <Link
                  to={ROUTES.register}
                  className="text-primary flex items-center gap-1 text-sm font-medium hover:underline"
                >
                  Voir tout
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>

              <ul className="divide-border divide-y">
                {APERCU_PLANNING.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground font-mono text-sm">{row.id}</span>
                        <Badge variant={row.variant}>{row.statut}</Badge>
                        <span className="text-foreground text-sm font-semibold">{row.titre}</span>
                      </div>
                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span>{row.client}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" aria-hidden="true" />
                          {row.heure}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3.5" aria-hidden="true" />
                          {row.lieu}
                        </span>
                      </div>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-sm sm:text-right">
                      {row.tech}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
