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
    <section className="py-16 sm:py-24 bg-transparent text-white">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-6">
        {/* EN-TÊTE : GESTION OPTIMISÉE DE L'ESPACE SUR LA GAUCHE */}
        <div className="w-full max-w-2xl lg:max-w-3xl text-left flex flex-col items-start space-y-5">
          {/* Badge Titre */}
          <div className="inline-flex items-center gap-2 rounded-none border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-bold text-cyan-300 shadow-xs">
            <Boxes className="size-3.5 text-cyan-400" />
            <span>Cockpit Opérationnel Tout-en-Un</span>
          </div>

          {/* Titre H2 Principal */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight text-left">
            Un seul outil pour piloter vos équipes, vos stocks et vos chantiers
          </h2>

          {/* Paragraphe Explicatif */}
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal max-w-2xl text-left">
            Fini la dispersion entre carnets papier, fichiers Excel et messageries. REZO360 réunit tout le cycle
            opérationnel de votre entreprise technique dans une interface moderne, fluide et rapide.
          </p>

          {/* Points forts / Avantages clés avec adaptation responsive fluide */}
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-3 sm:gap-x-4 gap-y-2 pt-1 text-xs text-slate-300 w-full">
            <div className="flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
              <span>Zéro double saisie</span>
            </div>
            <span className="text-white/20 shrink-0 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="size-3.5 text-cyan-400 shrink-0" />
              <span>Alertes stock intelligentes</span>
            </div>
            <span className="text-white/20 shrink-0 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="size-3.5 text-purple-400 shrink-0" />
              <span>Suivi flotte &amp; outillage</span>
            </div>
            <span className="text-white/20 shrink-0 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="size-3.5 text-amber-400 shrink-0" />
              <span>Signature client immédiate</span>
            </div>
          </div>

          {/* Grille 2x2 des 4 Piliers Majeurs entièrement positionnée à gauche avec Bords Carrés */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5 w-full">
            {/* 1. PILOTAGE DES ÉQUIPES & MISSIONS */}
            <div className="group flex flex-col justify-between border border-white/15 p-5 rounded-none backdrop-blur-xl bg-white/[0.04] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-white/[0.08] hover:border-cyan-500/40">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-none bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Users className="size-4.5" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-none px-2.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/30 bg-cyan-950/40">
                    <Smartphone className="size-3" />
                    Mobilité PWA
                  </span>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Planning &amp; Signatures clients
                  </h3>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    Affectation des techniciens, suivi des chantiers en direct et signature mobile.
                  </p>
                </div>

                {/* Aperçu Visuel : Fiche Mission */}
                <div className="rounded-none border border-white/10 p-3 space-y-2 text-xs backdrop-blur-md bg-white/[0.03]">
                  <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3 text-cyan-400" />
                      <span className="text-[11px] font-bold text-white">#INT-2026-44</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                      <CheckCircle2 className="size-3" />
                      Validée
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Centre Médical Nord</span>
                    <span className="font-semibold text-slate-200">Alexandre M.</span>
                  </div>
                  <div className="pt-1 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                    <FileCheck2 className="size-3 text-cyan-400" />
                    <span>✓ Signature client certifiée</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. GESTION DES STOCKS & CONSOMMABLES */}
            <div className="group flex flex-col justify-between border border-white/15 p-5 rounded-none backdrop-blur-xl bg-white/[0.04] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-white/[0.08] hover:border-emerald-500/40">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-none bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Package className="size-4.5" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-none px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30 bg-emerald-950/40">
                    <CheckCircle2 className="size-3" />
                    Zéro Rupture
                  </span>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Stock &amp; Consommables temps réel
                  </h3>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    Sorties par technicien et alertes automatiques sous seuil critique.
                  </p>
                </div>

                {/* Jauges de stock */}
                <div className="rounded-none border border-white/10 p-3 space-y-2 backdrop-blur-md bg-white/[0.03]">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-200">Câble RJ45 Cat.6A (305m)</span>
                      <span className="text-emerald-400 font-mono">14 en stock</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-none bg-white/10">
                      <div className="h-full rounded-none bg-emerald-500" style={{ width: '85%' }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-200">Disjoncteur 16A Courbe C</span>
                      <span className="text-amber-400 font-mono flex items-center gap-1">
                        <AlertTriangle className="size-3" />
                        3 restants
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-none bg-white/10">
                      <div className="h-full rounded-none bg-amber-500" style={{ width: '25%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. ACHATS & FOURNISSEURS */}
            <div className="group flex flex-col justify-between border border-white/15 p-5 rounded-none backdrop-blur-xl bg-white/[0.04] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-white/[0.08] hover:border-amber-500/40">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-none bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <ShoppingCart className="size-4.5" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-none px-2.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30 bg-amber-950/40">
                    <Truck className="size-3" />
                    Achats Grossistes
                  </span>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Commandes Fournisseurs
                  </h3>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    Bons de commande en 1 clic et injection automatique en stock à réception.
                  </p>
                </div>

                {/* Bon de commande */}
                <div className="rounded-none border border-white/10 p-3 space-y-1.5 text-xs backdrop-blur-md bg-white/[0.03]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-[11px]">#BC-2026-089</span>
                    <span className="rounded-none border border-cyan-500/30 bg-cyan-950/40 px-2 py-0.5 font-bold text-cyan-300 text-[10px]">
                      Rexel
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>12 articles</span>
                    <span className="font-mono font-bold text-slate-200">1 420,50 € HT</span>
                  </div>
                  <div className="pt-1 text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    <span>Réception conforme validée</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. PARC MATÉRIEL & CONFORMITÉ */}
            <div className="group flex flex-col justify-between border border-white/15 p-5 rounded-none backdrop-blur-xl bg-white/[0.04] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-white/[0.08] hover:border-purple-500/40">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-none bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Wrench className="size-4.5" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-none px-2.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/30 bg-purple-950/40">
                    <ShieldCheck className="size-3" />
                    Conformité Parc
                  </span>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Parc Matériel &amp; Véhicules
                  </h3>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    Affectation outillage, dates d’étalonnage et contrôles techniques suivis.
                  </p>
                </div>

                {/* Équipement & Véhicule */}
                <div className="rounded-none border border-white/10 p-3 space-y-1.5 text-xs backdrop-blur-md bg-white/[0.03]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-white flex items-center gap-1">
                      <Truck className="size-3 text-purple-400" />
                      Fourgon Master #03
                    </span>
                    <span className="text-emerald-400 font-bold text-[10px]">CT OK (2027)</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                    <span className="font-bold text-white flex items-center gap-1">
                      <Wrench className="size-3 text-purple-400" />
                      OTDR Fibre Optique
                    </span>
                    <span className="text-cyan-300 font-bold text-[10px]">Étalonnage certifié</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bouton d'action épuré */}
          <div className="pt-4 flex items-center justify-start">
            <Link
              to={ROUTES.register}
              className="inline-flex items-center gap-2 text-sm sm:text-base font-bold text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer"
            >
              <Zap className="size-4 text-cyan-400" />
              <span>Découvrir le cockpit complet gratuitement</span>
              <ArrowRight className="size-4 text-cyan-400" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
