import { useEffect, useRef, useState } from 'react';
import {
  User,
  Mail,
  ShieldCheck,
  Award,
  Wrench,
  MapPin,
  Clock,
  Briefcase,
  Smartphone,
  Save,
  Zap,
  HardHat,
  Star,
  Activity,
  FileCheck,
  Pencil,
  Plus,
  Trash2,
  Check,
  Camera,
  Sparkles,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { FormError } from '@/components/feedback/FormError';
import { useAuth } from '@/features/auth';
import {
  AvatarPickerModal,
  useAvatarStore,
  useMyProfile,
  useUpdateMyProfile,
  type FullProfile,
} from '@/features/profile';
import { formatDate } from '@/lib/format';

export interface EquipmentItem {
  id: string;
  name: string;
  serial: string;
  color: 'blue' | 'emerald' | 'amber' | 'purple';
}

export interface UserProfileData {
  displayName: string;
  jobTitle: string;
  phone: string;
  zone: string;
  habElec: string;
  habElecExpiry: string;
  habCaces: string;
  habCacesInfo: string;
  equipments: EquipmentItem[];
}

const DEFAULT_PROFILE: UserProfileData = {
  displayName: 'Stéphane Leduc',
  jobTitle: 'Technicien Réseaux, Fibre & Infrastructures Senior',
  phone: '0696 45 89 12',
  zone: 'Martinique (Fort-de-France & Technopole)',
  habElec: 'Habilitation Électrique H0V / B2V',
  habElecExpiry: "Valide jusqu'en Novembre 2027",
  habCaces: 'CACES R486 & Travaux en Hauteur',
  habCacesInfo: 'Intervention Pylônes & Nacelles',
  equipments: [
    {
      id: 'eq-1',
      name: 'Réflectomètre OTDR VIAVI SmartOTDR',
      serial: 'OTDR-972-88',
      color: 'blue',
    },
    {
      id: 'eq-2',
      name: 'Soudeuse Fibre Fujikura 70S+',
      serial: 'FJ-70S-410',
      color: 'emerald',
    },
    {
      id: 'eq-3',
      name: 'Pince Ampèremétrique Fluke 376 FC',
      serial: 'FLK-376-90',
      color: 'amber',
    },
  ],
};

/**
 * Ligne `profiles` → formulaire.
 *
 * Les habilitations et le matériel déclaré sont stockés en `jsonb` : leur forme
 * varie d'un métier à l'autre, et aucune requête ne filtre dessus. La lecture
 * reste donc défensive — une valeur écrite par une version antérieure du
 * formulaire ne doit pas faire planter la page.
 */
function toFormProfile(full: FullProfile | undefined, fallbackName: string): UserProfileData {
  const identity = full?.identity ?? null;
  const details = full?.details ?? null;

  const certifications = Array.isArray(details?.certifications)
    ? (details.certifications as { label?: string; detail?: string; expires_at?: string }[])
    : [];
  const equipments = Array.isArray(details?.equipments)
    ? (details.equipments as { id?: string; name?: string; serial?: string }[])
    : [];

  const [elec, caces] = certifications;

  return {
    displayName: identity?.display_name ?? fallbackName,
    jobTitle: DEFAULT_PROFILE.jobTitle,
    phone: details?.phone ?? '',
    zone: details?.zone ?? '',
    habElec: elec?.label ?? '',
    habElecExpiry: elec?.detail ?? '',
    habCaces: caces?.label ?? '',
    habCacesInfo: caces?.detail ?? '',
    equipments: equipments.map((item, index) => ({
      id: item.id ?? `eq-${index}`,
      name: item.name ?? '',
      serial: item.serial ?? '',
      color: 'blue' as const,
    })),
  };
}

export default function ProfilePage() {
  const { user } = useAuth();
  const profileQuery = useMyProfile();
  const updateProfile = useUpdateMyProfile();

  const fallbackName =
    (user?.user_metadata['display_name'] as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Utilisateur';

  const remoteProfile = toFormProfile(profileQuery.data ?? undefined, fallbackName);

  /**
   * Tampon d'édition.
   *
   * Les champs de cette page se modifient sur place et ne sont enregistrés qu'au
   * clic sur « Sauvegarder ». Éditer directement l'objet dérivé du cache le
   * ferait réapparaître tel quel au premier rafraîchissement en arrière-plan,
   * effaçant la saisie en cours.
   */
  const [profile, setProfile] = useState<UserProfileData>(remoteProfile);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    const loadedId = profileQuery.data?.identity?.id ?? null;
    if (loadedId === null || loadedFor.current === loadedId) return;

    loadedFor.current = loadedId;
    setProfile(remoteProfile);
  }, [profileQuery.data, remoteProfile]);

  const { avatarUrl } = useAvatarStore();
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftProfile, setDraftProfile] = useState<UserProfileData>(profile);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const handleOpenModal = () => {
    // Copie profonde : l'édition ne doit pas modifier l'objet dérivé du cache,
    // qu'un abandon devrait laisser intact.
    setDraftProfile(structuredClone(profile));
    setIsModalOpen(true);
  };

  const handleSaveProfile = (dataToSave: UserProfileData) => {
    setSubmitError(null);

    updateProfile.mutate(
      {
        identity: { display_name: dataToSave.displayName.trim() },
        details: {
          phone: dataToSave.phone.trim() === '' ? null : dataToSave.phone.trim(),
          zone: dataToSave.zone.trim() === '' ? null : dataToSave.zone.trim(),
          certifications: [
            { label: dataToSave.habElec, detail: dataToSave.habElecExpiry },
            { label: dataToSave.habCaces, detail: dataToSave.habCacesInfo },
          ],
          equipments: dataToSave.equipments.map((eq) => ({
            id: eq.id,
            name: eq.name,
            serial: eq.serial,
          })),
        },
      },
      {
        onSuccess: () => {
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 3000);
        },
        onError: setSubmitError,
      },
    );
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveProfile(draftProfile);
    setIsModalOpen(false);
  };

  // Helper équipement dans la modale
  const handleAddEquipment = () => {
    const newEq: EquipmentItem = {
      id: `eq-${Date.now()}`,
      name: '',
      serial: '',
      color: 'blue',
    };
    setDraftProfile({
      ...draftProfile,
      equipments: [...draftProfile.equipments, newEq],
    });
  };

  const handleRemoveEquipment = (id: string) => {
    setDraftProfile({
      ...draftProfile,
      equipments: draftProfile.equipments.filter((eq) => eq.id !== id),
    });
  };

  const handleUpdateEquipment = (id: string, key: 'name' | 'serial', value: string) => {
    setDraftProfile({
      ...draftProfile,
      equipments: draftProfile.equipments.map((eq) =>
        eq.id === id ? { ...eq, [key]: value } : eq,
      ),
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <PageHeader
        title="Profil & Fiche Technicien"
        description="Gérez vos données professionnelles, vos habilitations techniques, votre matériel attribué et vos préférences d'intervention."
      />

      {/*
        Bandeau d'identité, sans dégradé.

        Il en portait deux : un fondu vers `slate-800` et un voile bleu sur le
        tiers droit. Écrits pour un fond sombre, ils produisaient en thème clair
        un coin bleu nuit qui avalait le bouton « Sauvegarder » — un aplat suffit.
      */}
      <Card className="border-border bg-surface text-foreground shadow-raised relative overflow-hidden p-4 sm:p-6">

        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-5">
            <div className="relative group">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="relative block rounded-full focus:outline-none focus:ring-4 focus:ring-primary/40 cursor-pointer"
                title="Changer de photo de profil 3D"
              >
                <Avatar
                  src={avatarUrl}
                  name={profile.displayName}
                  size="lg"
                  className="size-20 text-xl font-bold ring-4 ring-primary/40 shadow-lg transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                  <Camera className="size-5" />
                  <span className="text-[9px] font-bold mt-0.5">Modifier</span>
                </div>
              </button>
              <span
                className="ring-surface absolute right-0 bottom-0 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-3xs text-white ring-2 pointer-events-none shadow-xs"
                title="Disponible pour intervention"
              >
                ✓
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-foreground">{profile.displayName}</h2>
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="flex items-center gap-1 text-3xs font-bold text-primary hover:underline cursor-pointer bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md transition-colors"
                  title="Choisir un avatar 3D (patron, technicien, etc.)"
                >
                  <Sparkles className="size-3 text-amber-500" />
                  <span>Changer d'avatar 3D</span>
                </button>
                <Badge
                  variant="outline"
                  className="border-blue-400/40 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300"
                >
                  Administrateur & Expert Terrain
                </Badge>
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                >
                  🟢 En service
                </Badge>
              </div>
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Briefcase className="size-3.5 text-primary" />
                {profile.jobTitle}
              </p>
              <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 text-muted-foreground" />
                  {profile.zone}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3 text-muted-foreground" />
                  Membre depuis : {user?.created_at ? formatDate(user.created_at) : '9 août 2026'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col items-stretch gap-2 border-t border-border-strong pt-4 md:w-auto md:items-end md:border-t-0 md:pt-0">
            <Button
              variant="primary"
              onClick={() => handleSaveProfile(profile)}
              disabled={updateProfile.isPending}
              className="cursor-pointer gap-2 bg-blue-600 font-medium text-white shadow-md hover:bg-blue-500"
            >
              <Save className="size-4" />
              {updateProfile.isPending
                ? 'Enregistrement…'
                : savedSuccess
                  ? 'Enregistré !'
                  : 'Sauvegarder le profil'}
            </Button>
            <FormError error={submitError} />
          </div>
        </div>
      </Card>

      {/* Grid Principal */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne Gauche (2/3) : Coordonnées + Habilitations & Matériel */}
        <div className="space-y-6 lg:col-span-2">
          {/* Card 1 : Coordonnées Professionnelles */}
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <User className="size-4 text-primary" />
                Informations & Coordonnées
              </CardTitle>
              <CardDescription>
                Identité et informations de contact utilisées sur vos PV d'intervention et fiches de mission.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Nom affiché / Prénom Nom"
                  value={profile.displayName}
                  onChange={(e) => {
                    const updated = { ...profile, displayName: e.target.value };
                    setProfile(updated);
                  }}
                />
                <Input
                  label="Titre & Fonction Métier"
                  value={profile.jobTitle}
                  onChange={(e) => {
                    const updated = { ...profile, jobTitle: e.target.value };
                    setProfile(updated);
                  }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="profile-email-readonly" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Adresse e-mail (Compte)
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3 size-4 text-muted-foreground" />
                    <input
                      id="profile-email-readonly"
                      type="email"
                      value={user?.email ?? ''}
                      readOnly
                      disabled
                      className="w-full rounded-md border border-border-strong bg-surface py-2 pr-24 pl-9 text-sm text-muted-foreground opacity-80 cursor-not-allowed"
                    />
                    <span className="absolute right-2 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
                      ✓ Vérifiée
                    </span>
                  </div>
                </div>

                <Input
                  label="Téléphone mobile direct"
                  value={profile.phone}
                  onChange={(e) => {
                    const updated = { ...profile, phone: e.target.value };
                    setProfile(updated);
                  }}
                />
              </div>

              <div>
                <Input
                  label="Secteur / Zone d'intervention privilégiée"
                  value={profile.zone}
                  onChange={(e) => {
                    const updated = { ...profile, zone: e.target.value };
                    setProfile(updated);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 2 : Habilitations, Sécurité & Matériel de Mesure */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <HardHat className="size-4 text-amber-600 dark:text-amber-400" />
                  Habilitations & Matériel Attribué
                </CardTitle>
                <CardDescription className="mt-1">
                  Accréditations électriques, diplômes de sécurité et outillage de mesure enregistrés sur votre profil.
                </CardDescription>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenModal}
                className="cursor-pointer shrink-0 gap-1.5 text-xs"
              >
                <Pencil className="size-3.5" />
                Modifier
              </Button>
            </CardHeader>

            <CardContent className="space-y-6 pt-5">
              {/* Habilitations */}
              <div>
                <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  Habilitations & Certifications Sécurité
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {profile.habElec.trim() !== '' ? (
                    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
                      <Zap className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{profile.habElec}</p>
                        <p className="mt-0.5 text-2xs text-muted-foreground">{profile.habElecExpiry || "Valide"}</p>
                      </div>
                    </div>
                  ) : null}

                  {profile.habCaces.trim() !== '' ? (
                    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
                      <Award className="mt-0.5 size-5 shrink-0 text-primary" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{profile.habCaces}</p>
                        <p className="mt-0.5 text-2xs text-muted-foreground">{profile.habCacesInfo || "Intervention Nacelle"}</p>
                      </div>
                    </div>
                  ) : null}

                  {profile.habElec.trim() === '' && profile.habCaces.trim() === '' ? (
                    <p className="col-span-2 text-xs italic text-subtle-foreground">
                      Aucune habilitation enregistrée. Cliquez sur "Modifier" pour en ajouter une.
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Équipements attribués */}
              <div className="border-t border-border pt-4">
                <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  <Wrench className="size-3.5 text-primary" />
                  Équipements & Instruments de Mesure Détenus
                </h4>
                
                {profile.equipments.filter((eq) => eq.name.trim() !== '').length > 0 ? (
                  <div className="space-y-2.5">
                    {profile.equipments
                      .filter((eq) => eq.name.trim() !== '')
                      .map((eq, index) => {
                        const dotColor =
                          index % 3 === 0
                            ? 'bg-blue-500'
                            : index % 3 === 1
                              ? 'bg-emerald-500'
                              : 'bg-amber-500';

                        return (
                          <div
                            key={eq.id}
                            className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`size-2 rounded-full ${dotColor}`} />
                              <span className="font-medium text-foreground">{eq.name}</span>
                            </div>
                            {eq.serial.trim() !== '' ? (
                              <span className="rounded bg-surface-raised px-2 py-0.5 font-mono text-2xs text-muted-foreground">
                                S/N: {eq.serial}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-xs italic text-subtle-foreground">
                    Aucun équipement de mesure enregistré. Cliquez sur "Modifier" pour en déclarer.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Colonne Droite (1/3) : Stats Performance & Identifiants */}
        <div className="space-y-6">
          {/* Card 3 : Statistiques de Performance */}
          <Card className="border-blue-500/20 bg-gradient-to-b from-surface to-surface-sunken">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Activity className="size-4 text-emerald-600 dark:text-emerald-400" />
                Performance 30 Jours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                <div className="space-y-0.5">
                  <p className="text-2xs font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                    Missions Réalisées
                  </p>
                  <p className="text-xl font-bold text-foreground">48 missions</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Star className="size-3.5 fill-current" /> 98.2%
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                <div className="space-y-1 rounded-lg border border-border bg-surface p-3">
                  <span className="block text-2xs text-muted-foreground">Temps moyen</span>
                  <span className="text-sm font-bold text-foreground">1h 35min</span>
                </div>
                <div className="space-y-1 rounded-lg border border-border bg-surface p-3">
                  <span className="block text-2xs text-muted-foreground">PV Signés</span>
                  <span className="flex items-center gap-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    <FileCheck className="size-3.5" /> 42 validés
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 rounded-lg border border-border bg-surface p-3 text-2xs text-muted-foreground">
                <div className="flex justify-between font-medium text-muted-foreground">
                  <span>Satisfaction Client</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">4.9 / 5.0 ★</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                  <div className="h-full w-[98%] rounded-full bg-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4 : Identifiants Techniques & Sécurité */}
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Smartphone className="size-4 text-purple-600 dark:text-purple-400" />
                Identifiants & Sécurité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5 text-xs">
              <div>
                <p className="text-subtle-foreground text-2xs font-semibold tracking-wider uppercase">
                  Identifiant Unique Supabase (UUID)
                </p>
                <p className="mt-1 rounded border border-border bg-surface p-2 font-mono text-2xs text-muted-foreground break-all select-all">
                  {user?.id ?? 'c208bc1c-68a1-48be-8bb7-ca96555a13be'}
                </p>
              </div>

              <div>
                <p className="text-subtle-foreground text-2xs font-semibold tracking-wider uppercase">
                  Type de compte & Rôle
                </p>
                <div className="mt-1 flex items-center justify-between rounded border border-border bg-surface p-2">
                  <span className="font-medium text-foreground">Administrateur Technique</span>
                  <span className="text-2xs font-semibold text-primary">Accès global</span>
                </div>
              </div>

              <div>
                <p className="text-subtle-foreground text-2xs font-semibold tracking-wider uppercase">
                  Application Mobile Enregistrée
                </p>
                <div className="mt-1 flex items-center justify-between rounded border border-border bg-surface p-2">
                  <span className="font-medium text-foreground">Android App (SM-G990B)</span>
                  <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400">🟢 Connectée</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal d'édition des Habilitations & Équipements */}
      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Gérer les habilitations & équipements"
        description="Modifiez ou ajoutez les matériels de mesure et habilitations attribués à votre fiche technicien."
        size="lg"
      >
        <form onSubmit={handleModalSubmit} className="space-y-5 pt-2">
          {/* Section Équipements */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                <Wrench className="size-3.5 text-primary" />
                Équipements & Instruments de Mesure
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddEquipment}
                className="cursor-pointer gap-1 text-xs text-primary hover:text-primary-hover"
              >
                <Plus className="size-3.5" /> Ajouter un matériel
              </Button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {draftProfile.equipments.map((eq) => (
                <div key={eq.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2.5">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="Nom de l'équipement (ex: Soudeuse Fujikura)"
                      value={eq.name}
                      onChange={(e) => handleUpdateEquipment(eq.id, 'name', e.target.value)}
                    />
                    <Input
                      placeholder="Matricule / S/N (ex: FJ-70S-410)"
                      value={eq.serial}
                      onChange={(e) => handleUpdateEquipment(eq.id, 'serial', e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRemoveEquipment(eq.id)}
                    className="cursor-pointer text-muted-foreground hover:text-error shrink-0"
                    title="Supprimer cet équipement"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Section Habilitations */}
          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              Habilitations Électriques & Sécurité
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Habilitation Électrique (Nom / Niveau)"
                placeholder="ex: Habilitation Électrique H0V / B2V"
                value={draftProfile.habElec}
                onChange={(e) => setDraftProfile({ ...draftProfile, habElec: e.target.value })}
              />
              <Input
                label="Date / Validité"
                placeholder="ex: Valide jusqu'en Novembre 2027"
                value={draftProfile.habElecExpiry}
                onChange={(e) => setDraftProfile({ ...draftProfile, habElecExpiry: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Input
                label="Certification Sécurité / CACES"
                placeholder="ex: CACES R486 & Travaux en Hauteur"
                value={draftProfile.habCaces}
                onChange={(e) => setDraftProfile({ ...draftProfile, habCaces: e.target.value })}
              />
              <Input
                label="Détail d'intervention"
                placeholder="ex: Intervention Pylônes & Nacelles"
                value={draftProfile.habCacesInfo}
                onChange={(e) => setDraftProfile({ ...draftProfile, habCacesInfo: e.target.value })}
              />
            </div>
          </div>

          {/* Boutons d'action de la modale */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="cursor-pointer"
            >
              Annuler
            </Button>
            <Button type="submit" variant="primary" className="cursor-pointer gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold">
              <Check className="size-4" />
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modale de Sélection d'Avatar 3D */}
      <AvatarPickerModal
        open={isAvatarModalOpen}
        onOpenChange={setIsAvatarModalOpen}
      />
    </div>
  );
}
