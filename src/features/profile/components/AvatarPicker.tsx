import { Check, User } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';

import { AVATARS, cheminAvatar } from '@/config/avatars';

import { useMyProfile, useUpdateMyProfile } from '../hooks';

export interface AvatarPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * La galerie des 50 avatars.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SÉLECTIONNER N'EST PAS ENREGISTRER
 *
 * Un clic sur une vignette ne modifie que l'état local (`selection`) : rien
 * n'est écrit tant que « Enregistrer » n'a pas été pressé. C'est le brief qui
 * distingue les deux comme deux étapes séparées, et c'est aussi la seule façon
 * d'éviter qu'un survol maladroit au doigt sur mobile écrase silencieusement
 * le choix précédent.
 *
 * L'écriture passe par `useUpdateMyProfile`, le même chemin que le nom
 * affiché : elle invalide déjà la requête `['organizations']`, ce qui est ce
 * qui fait apparaître le nouvel avatar dans la liste des membres — sans lui,
 * seul le compte de l'auteur du changement aurait vu la mise à jour.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function AvatarPicker({ open, onOpenChange }: AvatarPickerProps) {
  const profileQuery = useMyProfile();
  const updateProfile = useUpdateMyProfile();

  const avatarActuel = profileQuery.data?.identity?.avatar_id ?? null;
  const [selection, setSelection] = useState<string | null>(avatarActuel);

  // Rouvrir la galerie doit repartir du choix réellement enregistré, pas d'une
  // sélection abandonnée lors d'une fermeture précédente sans « Enregistrer ».
  const handleOpenChange = (next: boolean) => {
    if (next) setSelection(avatarActuel);
    onOpenChange(next);
  };

  const aChange = selection !== avatarActuel;

  const handleSave = () => {
    updateProfile.mutate(
      { identity: { avatar_id: selection } },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="Choisir votre avatar"
      description="50 avatars REZO360 — sélectionnez celui qui vous représente, puis enregistrez."
      size="lg"
    >
      <div className="space-y-4 pt-1">
        {/*
          MOBILE-FIRST : quatre colonnes tiennent sans défilement horizontal
          dès 320 px, chaque vignette dépasse largement les 44 px de cible
          tactile. La densité augmente par paliers avec la largeur — huit
          colonnes à partir de `lg`, pour une grille compacte sur bureau.
        */}
        <div className="grid max-h-[420px] grid-cols-4 gap-2.5 overflow-y-auto p-1 xs:grid-cols-5 sm:grid-cols-6 lg:grid-cols-8">
          {AVATARS.map((avatar) => {
            const isSelected = selection === avatar.id;

            return (
              <button
                key={avatar.id}
                type="button"
                onClick={() => setSelection(avatar.id)}
                aria-pressed={isSelected}
                title={avatar.id}
                className={cn(
                  'group relative flex aspect-square items-center justify-center rounded-full transition-all cursor-pointer',
                  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                  isSelected
                    ? 'ring-3 ring-primary ring-offset-2 ring-offset-surface'
                    : 'ring-1 ring-border hover:ring-2 hover:ring-primary/50',
                )}
              >
                <img
                  src={cheminAvatar(avatar.id)}
                  alt=""
                  className="size-full rounded-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />

                {isSelected ? (
                  <span className="bg-primary text-primary-foreground ring-surface absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full shadow-xs ring-2">
                    <Check className="size-3 stroke-[3]" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Boutons d'action */}
        <div className="border-border flex items-center justify-between border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelection(null)}
            className="text-muted-foreground hover:text-foreground gap-1.5 text-2xs"
          >
            <User className="size-3.5" />
            Utiliser mes initiales
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!aChange || updateProfile.isPending}
              className="gap-1.5 font-bold"
            >
              <Check className="size-3.5" />
              <span>{updateProfile.isPending ? 'Enregistrement…' : 'Enregistrer'}</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
