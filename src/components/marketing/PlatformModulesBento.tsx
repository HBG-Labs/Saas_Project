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

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

export function PlatformModulesBento() {
  return (
    <section className="py-16 sm:py-24 ">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* EN-TÊTE : GESTION OPTIMISÉE DE L'ESPACE SUR LA GAUCHE */}
        <div className="w-full max-w-2xl lg:max-w-3xl text-left flex flex-col items-start space-y-5">
          {/* Badge Titre */}
          <div className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-subtle px-3.5 py-1 text-xs font-bold text-primary shadow-xs">
            <Boxes className="size-3.5 text-primary" />
            <span>Cockpit Opérationnel Tout-en-Un</span>
          </div>

          {/* Titre H2 Principal */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-tight text-left">
            Un seul outil pour piloter vos équipes, vos stocks et vos chantiers
          </h2>

          {/* Paragraphe Explicatif */}
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-normal max-w-2xl text-left">
            Fini la dispersion entre carnets papier, fichiers Excel et messageries. REZO360 réunit tout le cycle
            opérationnel de votre entreprise technique dans une interface moderne, fluide et rapide.
          </p>

          {/* Points forts / Avantages clés avec adaptation responsive fluide */}
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-3 sm:gap-x-4 gap-y-2 pt-1 text-xs text-muted-foreground w-full">
            <div className="flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="size-3.5 text-success shrink-0" />
              <span>Zéro double saisie</span>
            </div>
            <span className="text-subtle-foreground shrink-0 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="size-3.5 text-primary shrink-0" />
              <span>Alertes stock intelligentes</span>
            </div>
            <span className="text-subtle-foreground shrink-0 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="size-3.5 text-accent shrink-0" />
              <span>Suivi flotte &amp; outillage</span>
            </div>
            <span className="text-subtle-foreground shrink-0 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="size-3.5 text-warning shrink-0" />
              <span>Signature client immédiate</span>
            </div>
          </div>

          {/* Grille 2x2 des 4 Piliers Majeurs entièrement positionnée à gauche avec Bords Carrés */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5 w-full">
            {/* 1. PILOTAGE DES ÉQUIPES & MISSIONS */}
            <div className="group flex flex-col justify-between border border-border p-5 rounded-xl bg-surface shadow-raised transition-all duration-300 hover:bg-surface hover:border-primary/40">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary-subtle text-primary border border-primary/30">
                    <Users className="size-4.5" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-xl px-2.5 py-0.5 text-xs font-bold text-primary border border-primary/30 bg-primary-subtle">
                    <Smartphone className="size-3" />
                    Mobilité PWA
                  </span>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    Planning &amp; Signatures clients
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Affectation des techniciens, suivi des chantiers en direct et signature mobile.
                  </p>
                </div>

                {/* Aperçu Visuel : Fiche Mission */}
                <div className="rounded-xl border border-border p-3 space-y-2 text-xs bg-surface">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3 text-primary" />
                      <span className="text-sm font-bold text-foreground">#INT-2026-44</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-success">
                      <CheckCircle2 className="size-3" />
                      Validée
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Centre Médical Nord</span>
                    <span className="font-semibold text-muted-foreground">Alexandre M.</span>
                  </div>
                  <div className="pt-1 text-xs font-bold text-success flex items-center gap-1">
                    <FileCheck2 className="size-3 text-primary" />
                    <span>✓ Signature client certifiée</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. GESTION DES STOCKS & CONSOMMABLES */}
            <div className="group flex flex-col justify-between border border-border p-5 rounded-xl bg-surface shadow-raised transition-all duration-300 hover:bg-surface hover:border-primary/30">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary-subtle text-success border border-primary/30">
                    <Package className="size-4.5" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-xl px-2.5 py-0.5 text-xs font-bold text-primary border border-primary/30 bg-primary-subtle">
                    <CheckCircle2 className="size-3" />
                    Zéro Rupture
                  </span>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    Stock &amp; Consommables temps réel
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Sorties par technicien et alertes automatiques sous seuil critique.
                  </p>
                </div>

                {/* Jauges de stock */}
                <div className="rounded-xl border border-border p-3 space-y-2 bg-surface">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-muted-foreground">Câble RJ45 Cat.6A (305m)</span>
                      <span className="text-success font-mono">14 en stock</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-xl bg-surface-hover">
                      <div className="h-full rounded-xl bg-primary" style={{ width: '85%' }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-muted-foreground">Disjoncteur 16A Courbe C</span>
                      <span className="text-warning font-mono flex items-center gap-1">
                        <AlertTriangle className="size-3" />
                        3 restants
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-xl bg-surface-hover">
                      <div className="h-full rounded-xl bg-primary" style={{ width: '25%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. ACHATS & FOURNISSEURS */}
            <div className="group flex flex-col justify-between border border-border p-5 rounded-xl bg-surface shadow-raised transition-all duration-300 hover:bg-surface hover:border-primary/30">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary-subtle text-warning border border-primary/30">
                    <ShoppingCart className="size-4.5" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-xl px-2.5 py-0.5 text-xs font-bold text-primary border border-primary/30 bg-primary-subtle">
                    <Truck className="size-3" />
                    Achats Grossistes
                  </span>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    Commandes Fournisseurs
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Bons de commande en 1 clic et injection automatique en stock à réception.
                  </p>
                </div>

                {/* Bon de commande */}
                <div className="rounded-xl border border-border p-3 space-y-1.5 text-xs bg-surface">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-sm">#BC-2026-089</span>
                    <span className="rounded-xl border border-primary/30 bg-primary-subtle px-2 py-0.5 font-bold text-primary text-xs">
                      Rexel
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground text-sm">
                    <span>12 articles</span>
                    <span className="font-mono font-bold text-muted-foreground">1 420,50 € HT</span>
                  </div>
                  <div className="pt-1 text-success font-semibold text-xs flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    <span>Réception conforme validée</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. PARC MATÉRIEL & CONFORMITÉ */}
            <div className="group flex flex-col justify-between border border-border p-5 rounded-xl bg-surface shadow-raised transition-all duration-300 hover:bg-surface hover:border-primary/30">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary-subtle text-accent border border-primary/30">
                    <Wrench className="size-4.5" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-xl px-2.5 py-0.5 text-xs font-bold text-primary border border-primary/30 bg-primary-subtle">
                    <ShieldCheck className="size-3" />
                    Conformité Parc
                  </span>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    Parc Matériel &amp; Véhicules
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Affectation outillage, dates d’étalonnage et contrôles techniques suivis.
                  </p>
                </div>

                {/* Équipement & Véhicule */}
                <div className="rounded-xl border border-border p-3 space-y-1.5 text-xs bg-surface">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-foreground flex items-center gap-1">
                      <Truck className="size-3 text-accent" />
                      Fourgon Master #03
                    </span>
                    <span className="text-success font-bold text-xs">CT OK (2027)</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-1 border-border border-t">
                    <span className="font-bold text-foreground flex items-center gap-1">
                      <Wrench className="size-3 text-accent" />
                      OTDR Fibre Optique
                    </span>
                    <span className="text-primary font-bold text-xs">Étalonnage certifié</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Un vrai bouton : c'était un lien texte, sans surface cliquable. */}
          <div className="pt-4">
            <Button asChild size="lg">
              <Link to={ROUTES.register}>
                <Zap className="size-4" aria-hidden="true" />
                Découvrir la plateforme gratuitement
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
