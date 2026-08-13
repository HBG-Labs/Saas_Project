import { useState } from 'react';
import { ShieldCheck, HardHat, Sparkles, Wrench, Search, RefreshCw, Maximize2, CheckCircle2, Cpu, Wifi, FileText } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { Modal } from '@/components/ui/Modal';
import { ROUTES } from '@/config/routes';
import { TECHNICIAN_IMAGES } from '@/assets/images/technicianData';

interface TechnicianHeroBannerProps {
  displayName: string;
  toolsCount: number;
}

export function TechnicianHeroBanner({ displayName, toolsCount }: TechnicianHeroBannerProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const currentImg = TECHNICIAN_IMAGES[selectedImageIndex % TECHNICIAN_IMAGES.length];

  // Le module d'images pourrait être vidé : mieux vaut ne rien afficher qu'une
  // bannière au visuel manquant.
  if (currentImg === undefined) return null;

  const handleNextImage = () => {
    setImageLoaded(false);
    setSelectedImageIndex((prev) => (prev + 1) % TECHNICIAN_IMAGES.length);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-8 shadow-sm transition-all duration-300 mb-8">
        <div className="relative z-10 grid gap-8 lg:grid-cols-12 lg:items-center">
          {/* Colonne Gauche : Cockpit & Informations du Technicien */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
            <div>
              {/* Badges de statut certifié */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-2xs font-semibold text-success shadow-inner">
                  <span className="size-2 rounded-full bg-success animate-pulse" />
                  Poste Technicien Connecté
                </div>

                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-2xs flex items-center gap-1">
                  <ShieldCheck className="size-3 text-primary" />
                  EPI & Casque de sécurité Certifiés
                </Badge>
              </div>

              {/* Titre & Message d'accueil */}
              <h1 className="text-foreground text-2xl font-black tracking-tight sm:text-4xl lg:text-3xl xl:text-4xl">
                Bonjour, <span className="bg-gradient-to-r from-primary via-primary-hover to-accent bg-clip-text text-transparent">{displayName}</span>
              </h1>
              <p className="text-muted-foreground mt-2 text-xs sm:text-sm leading-relaxed max-w-xl">
                Bienvenue sur votre cockpit d&apos;ingénierie terrain. Vos outils de calcul optique, électrique et réseau sont prêts pour vos interventions certifiées.
              </p>
            </div>

            {/* Raccourcis et Widgets de bord */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-border/70 bg-surface/60 p-3 backdrop-blur-sm shadow-xs">
                <div className="flex items-center gap-2 text-subtle-foreground text-2xs font-medium">
                  <HardHat className="size-3.5 text-warning" />
                  Équipement EPI
                </div>
                <div className="mt-1 text-xs font-bold text-foreground flex items-center gap-1">
                  <CheckCircle2 className="size-3 text-success" />
                  Casque & Lunettes OK
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-surface/60 p-3 backdrop-blur-sm shadow-xs">
                <div className="flex items-center gap-2 text-subtle-foreground text-2xs font-medium">
                  <Cpu className="size-3.5 text-primary" />
                  Mode Intervention
                </div>
                <div className="mt-1 text-xs font-bold text-foreground">
                  Datacenter / Chantier
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 rounded-xl border border-border/70 bg-surface/60 p-3 backdrop-blur-sm shadow-xs">
                <div className="flex items-center gap-2 text-subtle-foreground text-2xs font-medium">
                  <Wifi className="size-3.5 text-success" />
                  Liaison Terrain
                </div>
                <div className="mt-1 text-xs font-bold text-foreground">
                  Haute Définition
                </div>
              </div>
            </div>

            {/* Boutons d'Action */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Button asChild size="md" variant="primary" className="glow-primary rounded-xl font-semibold">
                <Link to={ROUTES.reports}>
                  <FileText className="size-4 mr-2" />
                  Rédiger un compte-rendu
                </Link>
              </Button>

              <Button asChild size="md" variant="outline" className="rounded-xl font-semibold">
                <Link to={ROUTES.tools}>
                  <Wrench className="size-4 mr-2" />
                  Catalogue des Outils
                </Link>
              </Button>

              <button
                type="button"
                onClick={handleNextImage}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised/80 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-surface-sunken hover:border-primary/50 transition-all cursor-pointer shadow-xs"
                title="Changer la vue d'intervention du technicien"
              >
                <RefreshCw className="size-3.5 text-primary animate-spin-slow" />
                Changer la vue ({selectedImageIndex + 1}/{TECHNICIAN_IMAGES.length})
              </button>
            </div>

            {/* Barre de Recherche Instantanée Kbd */}
            <div className="rounded-xl border border-border/80 bg-surface-sunken/90 p-3 flex items-center justify-between text-xs text-subtle-foreground">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-primary shrink-0" />
                <span>Recherche instantanée d&apos;outils & normes :</span>
                <div className="flex items-center gap-1">
                  <Kbd>⌘</Kbd><Kbd>K</Kbd>
                </div>
              </div>
              <span className="text-2xs font-semibold text-primary hidden sm:inline">
                {toolsCount} outils actifs
              </span>
            </div>
          </div>

          {/* Colonne Droite : Carte Visuelle avec la Photo du Technicien avec Casque */}
          <div className="lg:col-span-5 relative group">
            <div className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-surface-raised shadow-2xl transition-all duration-500 group-hover:border-primary/60 group-hover:shadow-primary/20">
              {/* Effet de brillance lors du survol */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10 pointer-events-none" />

              {/* Photo du Technicien avec Casque de Sécurité */}
              <div className="relative aspect-4/3 w-full overflow-hidden bg-surface-sunken">
                <img
                  src={currentImg.url}
                  alt={currentImg.alt}
                  onLoad={() => setImageLoaded(true)}
                  className={`size-full object-cover object-top transition-all duration-700 group-hover:scale-105 ${
                    imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 blur-sm'
                  }`}
                />

                {/* Badge Flottant "Casque de Sécurité Conforme" sur l'image */}
                <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-3 py-1 text-2xs font-medium text-white shadow-lg">
                  <HardHat className="size-3.5 text-warning" />
                  <span className="font-semibold text-amber-300">EPI Obligatoire</span>
                </div>

                {/* Bouton Agrandir Photo */}
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(true)}
                  className="absolute top-3 right-3 z-20 rounded-full bg-black/60 backdrop-blur-md border border-white/20 p-2 text-foreground hover:bg-primary hover:border-primary transition-all cursor-pointer shadow-lg"
                  title="Agrandir la photo du technicien"
                >
                  <Maximize2 className="size-4" />
                </button>
              </div>

              {/* Légende & Overlay sous la Photo */}
              <div className="absolute bottom-0 inset-x-0 z-20 p-4 text-foreground">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-1.5">
                      {currentImg.title}
                      <Sparkles className="size-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium">{currentImg.role}</p>
                  </div>
                  <span className="text-2xs font-mono rounded-md bg-primary/80 border border-primary-hover px-2 py-0.5 text-foreground">
                    {currentImg.environment}
                  </span>
                </div>

                <div className="mt-2.5 pt-2 border-t border-white/15 flex items-center justify-between text-2xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="size-3" />
                    {currentImg.badgeText}
                  </span>
                  <span className="text-muted-foreground">NexoraTech® Field</span>
                </div>
              </div>
            </div>

            {/* Légende d'inspiration sous la carte */}
            <p className="mt-2 text-center text-2xs text-subtle-foreground">
              Photo certifiée : Technicien qualifié équipé de casque blanc & matériel de mesure.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Agrandissement de la Photo du Technicien */}
      <Modal
        open={isZoomOpen}
        onOpenChange={setIsZoomOpen}
        title={currentImg.title}
        size="lg"
      >
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl border border-border bg-black aspect-16/10">
            <img
              src={currentImg.url}
              alt={currentImg.alt}
              className="size-full object-cover"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-white">{currentImg.title}</h4>
                  <p className="text-xs text-white/70">{currentImg.environment} — {currentImg.role}</p>
                </div>
                <Badge variant="outline" className="border-warning/40 bg-warning/20 text-warning text-xs">
                  <HardHat className="size-3.5 mr-1" />
                  Habilitation Casque Blanc
                </Badge>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-surface-sunken p-4 text-xs space-y-2">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-success" />
              Spécifications des équipements de protection du Technicien :
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground pt-1">
              <li className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" />
                Casque de chantier à protection d'impact EN 397
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" />
                Lunettes de sécurité avec filtrage laser optique EN 166
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" />
                Tablette durcie IP65 avec logiciel NexoraTech
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" />
                Gilet haute visibilité classe 2 & gants isolants
              </li>
            </ul>
          </div>
        </div>
      </Modal>
    </>
  );
}
