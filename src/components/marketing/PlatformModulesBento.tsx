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
  Zap,
} from 'lucide-react';
import { Link } from 'react-router';

import { ROUTES } from '@/config/routes';

export function PlatformModulesBento() {
  return (
    <section className="relative overflow-hidden border-t border-slate-200/80 bg-slate-50/50 py-20 dark:border-slate-800/80 dark:bg-[#060a12] sm:py-28">
      {/* Halos d'ambiance lumineux d'arrière-plan */}
      <div className="pointer-events-none absolute top-1/4 left-1/4 -z-10 h-[500px] w-[min(800px,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-blue-500/10 via-indigo-500/10 to-cyan-500/10 blur-[130px] dark:from-blue-600/15 dark:via-indigo-500/15 dark:to-cyan-400/10" />
      <div className="pointer-events-none absolute top-1/2 right-10 -z-10 size-96 rounded-full bg-indigo-500/10 dark:bg-purple-600/10 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* GRILLE 2 COLONNES : PHOTO DÉZOOMÉE & FONDUE À GAUCHE, TEXTE À DROITE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 xl:gap-12 items-center">
          {/* COLONNE GAUCHE : PHOTO DÉZOOMÉE DU COCKPIT AVEC FONDU ÉLÉGANT & SANS FILTRE NOIR */}
          <div className="lg:col-span-6 xl:col-span-6 relative">
            {/* Halo lumineux d'accentuation en arrière-plan */}
            <div className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-tr from-indigo-500/25 via-blue-600/25 to-cyan-500/25 blur-2xl opacity-70 dark:opacity-80" />

            {/* Cadre Visuel Haut de Gamme */}
            <div className="relative group overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-blue-500/30 bg-slate-900/5 dark:bg-slate-950/60 shadow-2xl shadow-blue-950/20 backdrop-blur-xs">
              {/* Photo Dézoomée, Nette et Lumineuse sans filtre assombrissant */}
              <img
                src="/images/backgrounds/supervision-control-room.jpg"
                alt="Supervision et pilotage des opérations REZO360"
                className="w-full h-auto max-h-[440px] object-cover object-center transform transition-transform duration-700 group-hover:scale-[1.02] filter contrast-105 saturate-110"
                loading="lazy"
              />

              {/* Fondus dégradés subtils & stylés pour une intégration fluide sans coupure */}
              {/* Fondu latéral droit (vers le texte à droite) */}
              <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-slate-50/90 via-slate-50/30 to-transparent dark:from-[#060a12]/90 dark:via-[#060a12]/30 dark:to-transparent" />
              {/* Fondu bas */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50/80 via-slate-50/20 to-transparent dark:from-[#060a12]/85 dark:via-[#060a12]/20 dark:to-transparent" />
              {/* Fondu latéral gauche léger */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-50/50 via-transparent to-transparent dark:from-[#060a12]/60 dark:via-transparent dark:to-transparent" />

              {/* Badges Flottants Discrets & Ultra-Fins */}
              {/* 1. Statut Centre de Contrôle en haut à gauche */}
              <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 rounded-full border border-blue-500/35 bg-slate-950/75 px-2.5 py-0.5 text-[10px] sm:text-2xs font-bold text-blue-300 backdrop-blur-md shadow-md">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-blue-400" />
                </span>
                <span>Centre de Supervision</span>
              </div>

              {/* 2. Badge Traçabilité en bas à gauche */}
              <div className="absolute bottom-2.5 left-2.5 z-20 hidden sm:flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/75 px-2.5 py-1 text-[10px] sm:text-2xs font-medium text-slate-200 backdrop-blur-md shadow-md">
                <ShieldCheck className="size-3 text-emerald-400" />
                <span>100% Traçabilité</span>
              </div>
            </div>
          </div>

          {/* COLONNE DROITE : TITRE, TEXTE ET POINTS CLÉS (CENTRÉ SUR MOBILE, ALIGNÉ À GAUCHE SUR DESKTOP) */}
          <div className="lg:col-span-6 xl:col-span-6 text-center lg:text-left flex flex-col items-center lg:items-start space-y-4">
            {/* Badge Titre */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/15 dark:border-blue-400/40 dark:bg-blue-950/80 px-4 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 backdrop-blur-md shadow-xs">
              <Boxes className="size-3.5 text-blue-600 dark:text-blue-400" />
              <span>Cockpit Opérationnel Tout-en-Un</span>
            </div>

            {/* Titre H2 Principal */}
            <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl lg:text-5xl leading-tight dark:text-white text-center lg:text-left">
              Un seul outil pour piloter vos équipes, vos stocks et vos chantiers
            </h2>

            {/* Paragraphe Explicatif */}
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal text-center lg:text-left mx-auto lg:mx-0">
              Fini la dispersion entre carnets papier, fichiers Excel et messageries. REZO360 réunit tout le cycle
              opérationnel de votre entreprise technique dans une interface moderne et rapide.
            </p>

            {/* Points forts / Avantages clés en grille */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 w-full text-xs text-slate-700 dark:text-slate-300 font-medium">
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-900/60 p-2.5 backdrop-blur-xs">
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                <span>Zéro double saisie</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-900/60 p-2.5 backdrop-blur-xs">
                <CheckCircle2 className="size-4 text-blue-500 shrink-0" />
                <span>Alertes stock intelligentes</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-900/60 p-2.5 backdrop-blur-xs">
                <CheckCircle2 className="size-4 text-purple-500 shrink-0" />
                <span>Suivi flotte &amp; outillage</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-900/60 p-2.5 backdrop-blur-xs">
                <CheckCircle2 className="size-4 text-amber-500 shrink-0" />
                <span>Signature client immédiate</span>
              </div>
            </div>
          </div>
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

        {/* Bouton d'action central haut de gamme au premier plan */}
        <div className="relative z-10 mt-14 flex justify-center text-center">
          <Link
            to={ROUTES.register}
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 p-px font-semibold text-white shadow-[0_0_25px_rgba(37,99,235,0.35)] transition-all duration-300 hover:shadow-[0_0_35px_rgba(6,182,212,0.55)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <span className="relative flex h-11 items-center gap-2.5 rounded-[11px] bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 px-7 text-xs sm:text-sm font-bold backdrop-blur-md transition-all duration-300">
              {/* Liseré supérieur de réflexion */}
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
              {/* Shimmer traversant */}
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />

              <Zap className="size-3.5 text-cyan-200 transition-transform duration-300 group-hover:scale-110" />
              <span>Découvrir le cockpit complet gratuitement</span>
              <ArrowRight className="size-3.5 text-white/90 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
