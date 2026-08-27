import {
  CheckCircle2,
  FileSpreadsheet,
  Lock,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ROUTES } from '@/config/routes';

export interface ProToolUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolName?: string;
  tradeName?: string;
}

export function ProToolUpgradeModal({
  open,
  onOpenChange,
  toolName,
  tradeName,
}: ProToolUpgradeModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Accès aux calculateurs métiers certifiés"
      hideTitle
      className="p-0 overflow-hidden"
    >
      <div className="relative p-6 sm:p-7 space-y-5">
        {/* Halo décoratif */}
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 size-48 rounded-full bg-primary/20 blur-3xl" />

        {/* En-tête avec badge et titre */}
        <div className="relative text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
            <Sparkles className="size-6 text-primary animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 text-3xs font-bold text-amber-700 dark:text-amber-400">
            <Lock className="size-3" />
            <span>Fonctionnalité Réservée aux Forfaits Pro</span>
          </div>

          <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
            {toolName
              ? `Débloquez le calculateur « ${toolName} »`
              : 'Débloquez les 36 calculateurs métiers certifiés'}
          </h2>

          <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {tradeName
              ? `Ce calculateur spécialisé ${tradeName} est inclus dans nos formules Starter, Pro et Business.`
              : 'Accédez à toutes les formules certifiées (Eurocodes, DTU, NF C 15-100, ITU-T) et aux exports techniques.'}
          </p>
        </div>

        {/* Avantages inclus dans les packs professionnels */}
        <div className="space-y-2.5 bg-surface-raised/70 border border-border/80 rounded-xl p-3.5 sm:p-4 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">36 Calculateurs Métiers Certifiés</p>
              <p className="text-3xs text-muted-foreground">
                Conformes aux normes françaises et européennes (BTP, Électricité, Plomberie, Fibre, Réseaux).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <FileSpreadsheet className="size-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">Exports PDF avec En-tête Entreprise</p>
              <p className="text-3xs text-muted-foreground">
                Générez des fiches de dimensionnement officielles prêtes à transmettre à vos clients ou bureaux d'études.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Zap className="size-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">Historique Cloud & Travail d'Équipe</p>
              <p className="text-3xs text-muted-foreground">
                Sauvegarde illimitée de tous les calculs de vos techniciens sur le terrain.
              </p>
            </div>
          </div>
        </div>

        {/* Aperçu des offres */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2.5 rounded-xl border border-border bg-surface text-xs space-y-0.5">
            <span className="text-3xs font-bold text-muted-foreground uppercase">Starter</span>
            <p className="text-sm font-black text-foreground">19 € <span className="text-3xs font-normal text-muted-foreground">/mois</span></p>
            <p className="text-3xs text-muted-foreground">2 techniciens inclus</p>
          </div>
          <div className="p-2.5 rounded-xl border border-primary/40 bg-primary/5 text-xs space-y-0.5 relative">
            <span className="absolute -top-2 right-2 rounded-full bg-primary px-1.5 py-0.2 text-4xs font-black text-primary-foreground">
              POPULAIRE
            </span>
            <span className="text-3xs font-bold text-primary uppercase">Pro ⭐</span>
            <p className="text-sm font-black text-foreground">39 € <span className="text-3xs font-normal text-muted-foreground">/mois</span></p>
            <p className="text-3xs text-muted-foreground">5 techniciens + modules complets</p>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto text-xs"
            onClick={() => onOpenChange(false)}
          >
            Continuer en mode gratuit
          </Button>

          <Button
            asChild
            variant="primary"
            className="w-full sm:flex-1 text-xs font-bold shadow-xs gap-1.5"
          >
            <Link to={ROUTES.pricing} onClick={() => onOpenChange(false)}>
              <span>Découvrir les offres Pro</span>
              <CheckCircle2 className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
