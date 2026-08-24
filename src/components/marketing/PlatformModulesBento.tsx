import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calendar,
  CheckCircle2,
  FileCheck2,
  Package,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

export function PlatformModulesBento() {
  return (
    <section className="relative overflow-hidden border-t border-slate-200/80 bg-slate-50/50 py-20 dark:border-slate-800/80 dark:bg-[#060a12] sm:py-28">
      {/* Fond d'ambiance 2 : Supervision & Centre de Contrôle Cockpit (Positionnement précis vers le haut sans zoom) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <img
          src="/images/backgrounds/cockpit-supervision-ambient.jpg"
          alt="Fond d'ambiance Cockpit Supervision REZO360"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center -translate-y-24 sm:-translate-y-48 lg:-translate-y-[360px] opacity-35 dark:opacity-45 filter saturate-110 contrast-105"
        />
        {/* Masque de transition doux haut et bas */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50/80 via-slate-50/40 to-slate-50/85 dark:from-[#060a12]/80 dark:via-[#060a12]/35 dark:to-[#060a12]/90" />
      </div>

      {/* Halo d'ambiance en arrière-plan */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 -z-10 h-[500px] w-[min(800px,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-blue-500/10 via-indigo-500/10 to-cyan-500/10 blur-[130px] dark:from-blue-600/15 dark:via-indigo-500/15 dark:to-cyan-400/10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* En-tête de la section */}
        <div className="mx-auto max-w-3xl text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-xs font-bold text-blue-600 dark:border-blue-500/30 dark:text-blue-400">
            <Boxes className="size-3.5" />
            <span>Cockpit Opérationnel Tout-en-Un</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl leading-tight dark:text-white">
            Un seul outil pour piloter vos équipes, vos stocks et vos chantiers
          </h2>

          <p className="text-base text-slate-600 sm:text-lg dark:text-slate-400 leading-relaxed">
            Fini la dispersion entre carnets papier, fichiers Excel et messageries. REZO360 réunit tout le cycle
            opérationnel de votre entreprise technique dans une interface moderne et rapide.
          </p>
        </div>

        {/* Bento Grid 4 Piliers Majeurs */}
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ------------------------------------------------------------- 1. PILOTAGE DES ÉQUIPES & MISSIONS (7 colonnes) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 p-6 shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-lg dark:border-slate-800/90 dark:bg-slate-900/85 lg:col-span-7 sm:p-8">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-500/20">
                  <Users className="size-6" />
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                  <Smartphone className="size-3.5" />
                  Terrain &amp; Mobilité PWA
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Planning, Fiches d’intervention &amp; Signatures clients
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Affectez les techniciens selon leurs disponibilités, suivez l’avancement des chantiers en direct et
                  recueillez la signature électronique du client sur smartphone dès la fin des travaux.
                </p>
              </div>

              {/* Aperçu Visuel : Fiche Mission Interactive */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Mission #INT-2026-44</span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-2xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="size-3" />
                    Terminée &amp; Validée
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-2xs uppercase">Client &amp; Site</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Centre Médical Nord</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-2xs uppercase">Technicien affecté</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Alexandre M.</span>
                  </div>
                </div>

                <div className="rounded-xl bg-white p-2.5 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-2xs">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <FileCheck2 className="size-4 text-blue-600 dark:text-cyan-400" />
                    <span>Rapport d’intervention PDF généré</span>
                  </div>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ Signature client certifiée</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Rôles adaptés : Chef d’entreprise, Conducteur de travaux, Technicien
              </span>
            </div>
          </div>

          {/* ------------------------------------------------------------- 2. GESTION DES STOCKS & CONSOMMABLES (5 colonnes) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 p-6 shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg dark:border-slate-800/90 dark:bg-slate-900/85 lg:col-span-5 sm:p-8">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500/20">
                  <Package className="size-6" />
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                  <CheckCircle2 className="size-3.5" />
                  Zéro Rupture Chantier
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Stock &amp; Consommables en temps réel
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Enregistrez les sorties de matériel par chantier et technicien. Soyez alerté automatiquement dès qu’une
                  référence passe sous le seuil d’alerte.
                </p>
              </div>

              {/* Jauges visuelles de stock */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/80 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">Câble RJ45 Cat.6A (Touret 305m)</span>
                    <span className="text-emerald-600 font-mono">14 / 15 en stock</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: '85%' }} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">Disjoncteur 16A Courbe C</span>
                    <span className="text-amber-600 font-mono flex items-center gap-1">
                      <AlertTriangle className="size-3" />
                      3 restants (Seuil bas)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: '25%' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span>Valorisation du stock &amp; alertes automatiques</span>
            </div>
          </div>

          {/* ------------------------------------------------------------- 3. ACHATS & FOURNISSEURS (5 colonnes) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 p-6 shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-lg dark:border-slate-800/90 dark:bg-slate-900/85 lg:col-span-5 sm:p-8">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-500/20">
                  <ShoppingCart className="size-6" />
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                  <Truck className="size-3.5" />
                  Approvisionnement
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Achats &amp; Commandes Fournisseurs
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Générez vos bons de commande fournisseurs en 1 clic. Réceptionnez vos articles avec injection
                  automatique dans votre stock sans double saisie.
                </p>
              </div>

              {/* Aperçu Bon de Commande */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/80 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">Commande #BC-2026-089</span>
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 font-bold text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                    Rexel Distribution
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>12 articles commandés</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">1 420,50 € HT</span>
                </div>
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-2xs">
                  <CheckCircle2 className="size-3.5" />
                  <span>Réception conforme — Stock incrémenté</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
              <span>Gestion des fournisseurs &amp; réceptions</span>
            </div>
          </div>

          {/* ------------------------------------------------------------- 4. PARC MATÉRIEL & CONFORMITÉ (7 colonnes) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 p-6 shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-lg dark:border-slate-800/90 dark:bg-slate-900/85 lg:col-span-7 sm:p-8">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-500/20">
                  <Wrench className="size-6" />
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
                  <ShieldCheck className="size-3.5" />
                  Conformité &amp; Parc
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Parc Matériel, Véhicules &amp; Outillage
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Affectez l’outillage spécialisé et les véhicules à vos équipes. Suivez les dates de révision,
                  d’étalonnage et de contrôle technique pour garantir une conformité sans faille.
                </p>
              </div>

              {/* Aperçu Équipement & Véhicule */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/80 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <Truck className="size-4 text-purple-600 dark:text-purple-400" />
                    <span>Fourgon Master #03</span>
                  </div>
                  <p className="text-slate-500 text-2xs">Affecté à l’équipe Réseaux Ouest</p>
                  <span className="inline-block rounded-md bg-emerald-500/10 px-2 py-0.5 text-2xs font-bold text-emerald-600 dark:text-emerald-400">
                    Contrôle technique OK (2027)
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/80 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <Wrench className="size-4 text-purple-600 dark:text-purple-400" />
                    <span>Réflectomètre Optique OTDR</span>
                  </div>
                  <p className="text-slate-500 text-2xs">N° Série : SN-88392-FTTH</p>
                  <span className="inline-block rounded-md bg-blue-500/10 px-2 py-0.5 text-2xs font-bold text-blue-600 dark:text-blue-400">
                    Étalonnage certifié
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                Traçabilité des équipements &amp; réduction des pertes de matériel
              </span>
            </div>
          </div>
        </div>

        {/* Bouton d'action central */}
        <div className="mt-12 text-center">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 px-8 font-bold text-white shadow-lg shadow-blue-600/25 ring-1 ring-white/20 hover:from-blue-500 hover:to-cyan-500 transition-all hover:-translate-y-0.5"
          >
            <Link to={ROUTES.register}>
              Découvrir le cockpit complet gratuitement
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
