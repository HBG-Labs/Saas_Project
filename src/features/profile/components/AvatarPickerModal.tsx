import { Check } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';

import { PROFILE_AVATARS, useAvatarStore, type ProfileAvatar } from '../avatars-data';

interface AvatarPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAvatar?: (url: string | null) => void;
}

export function AvatarPickerModal({
  open,
  onOpenChange,
  onSelectAvatar,
}: AvatarPickerModalProps) {
  const { avatarUrl, setAvatarUrl } = useAvatarStore();
  const [selectedUrl, setSelectedUrl] = useState<string | null>(avatarUrl);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'boss' | 'tech' | 'artisan' | 'abstract'>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');

  const filteredAvatars = PROFILE_AVATARS.filter((avatar) => {
    if (categoryFilter !== 'all' && avatar.category !== categoryFilter) return false;
    if (genderFilter !== 'all' && avatar.gender !== 'neutral' && avatar.gender !== genderFilter) return false;
    return true;
  });

  const selectedAvatarData: ProfileAvatar | undefined = PROFILE_AVATARS.find(
    (a) => a.url === (selectedUrl ?? avatarUrl),
  );

  const handleApply = () => {
    setAvatarUrl(selectedUrl);
    if (onSelectAvatar) {
      onSelectAvatar(selectedUrl);
    }
    onOpenChange(false);
  };

  const handleUseInitials = () => {
    setSelectedUrl(null);
    setAvatarUrl(null);
    if (onSelectAvatar) {
      onSelectAvatar(null);
    }
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Choisir votre photo de profil (Personnages 3D & Abstraits)"
      description="Sélectionnez un avatar animé ou un emblème abstrait haute précision pour vos fiches et votre compte."
      size="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Filtres par Rôle & Genre */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          {/* Rôle */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {[
              { id: 'all', label: 'Tous les styles' },
              { id: 'boss', label: '👔 Patrons & Dirigeants' },
              { id: 'tech', label: '👷‍♂️ Techniciens' },
              { id: 'artisan', label: '🛠️ Artisans' },
              { id: 'abstract', label: '🔮 Styles Abstraits' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCategoryFilter(f.id as typeof categoryFilter)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-2xs font-semibold transition-all cursor-pointer shrink-0',
                  categoryFilter === f.id
                    ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Genre */}
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: 'Tous' },
              { id: 'male', label: '👨 Hommes' },
              { id: 'female', label: '👩 Femmes' },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGenderFilter(g.id as typeof genderFilter)}
                className={cn(
                  'px-2 py-1 rounded-lg text-2xs font-medium transition-all cursor-pointer',
                  genderFilter === g.id
                    ? 'bg-surface-raised border border-border-strong text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grille des Avatars 3D */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-1">
          {filteredAvatars.map((avatar) => {
            const isSelected = selectedUrl === avatar.url;

            return (
              <button
                key={avatar.id}
                type="button"
                onClick={() => setSelectedUrl(avatar.url)}
                className={cn(
                  'group relative flex flex-col items-center p-2.5 rounded-xl border text-center transition-all cursor-pointer',
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-xs ring-2 ring-primary/30'
                    : 'border-border bg-surface hover:border-border-strong hover:bg-surface-hover/80',
                )}
              >
                {/* Image 3D Ronde */}
                <div className="relative size-20 sm:size-24 rounded-full overflow-hidden border-2 border-border/80 shadow-md transition-transform group-hover:scale-105">
                  <img
                    src={avatar.url}
                    alt={avatar.name}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center">
                      <span className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                        <Check className="size-4 stroke-[3]" />
                      </span>
                    </div>
                  )}
                </div>

                {/* Textes descriptifs */}
                <div className="mt-2 w-full min-w-0">
                  <h4 className="text-2xs font-bold text-foreground truncate">{avatar.name}</h4>
                  <Badge variant="outline" className="text-4xs px-1 py-0 h-4 mt-1">
                    {avatar.categoryLabel}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>

        {/* Aperçu du style sélectionné */}
        {selectedAvatarData ? (
          <div className="p-3 rounded-xl bg-surface border border-border flex items-center gap-3">
            <img
              src={selectedAvatarData.url}
              alt={selectedAvatarData.name}
              className="size-12 rounded-full border border-border shadow-xs shrink-0 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h5 className="text-xs font-bold text-foreground truncate">{selectedAvatarData.name}</h5>
                <Badge variant="primary" className="text-4xs font-mono">{selectedAvatarData.genderLabel}</Badge>
              </div>
              <p className="text-3xs text-muted-foreground mt-0.5">{selectedAvatarData.clothingStyle}</p>
            </div>
          </div>
        ) : null}

        {/* Boutons d'Action */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUseInitials}
            className="text-2xs text-muted-foreground hover:text-foreground"
          >
            Utiliser les initiales texte
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleApply}
              className="gap-1.5 font-bold"
            >
              <Check className="size-3.5" />
              <span>Appliquer cet avatar</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
