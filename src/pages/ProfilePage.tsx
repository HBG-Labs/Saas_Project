import { useState } from 'react';
import {
  User,
  Mail,
  ShieldCheck,
  Award,
  Wrench,
  MapPin,
  Clock,
  Briefcase,
  Save,
  Zap,
  HardHat,
  Pencil,
  Plus,
  Trash2,
  Check,
  Camera,
  Sparkles,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { FormError } from '@/components/feedback/FormError';
import { updatePassword, useAuth } from '@/features/auth';
import {
  ROLE_LABELS,
  updateOwnMemberContact,
  useCurrentOrganization,
} from '@/features/organizations';
import {
  AvatarPicker,
  useMyProfile,
  useUpdateMyProfile,
  type FullProfile,
} from '@/features/profile';
import { formatDate } from '@/lib/format';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';

export interface EquipmentItem {
  id: string;
  name: string;
  serial: string;
  color: 'blue' | 'emerald' | 'amber' | 'purple';
}

export interface CertificationItem {
  id: string;
  name: string;
  validity: string;
  detail: string;
}

export interface UserProfileData {
  displayName: string;
  jobTitle: string;
  phone: string;
  zone: string;
  certifications: CertificationItem[];
  equipments: EquipmentItem[];
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: Record<string, unknown>, key: string): string | undefined {
  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : undefined;
}

/**
 * Ligne `profiles` → formulaire.
 *
 * Les habilitations et le matériel déclaré sont stockés en `jsonb` : leur forme
 * varie d'un métier à l'autre, et aucune requête ne filtre dessus. La lecture
 * reste donc défensive — une valeur écrite par une version antérieure du
 * formulaire ne doit pas faire planter la page.
 */
function toFormProfile(
  full: FullProfile | undefined,
  fallbackName: string,
  fallbackJobTitle: string,
): UserProfileData {
  const identity = full?.identity ?? null;
  const details = full?.details ?? null;

  const rawCertifications: Record<string, unknown>[] = Array.isArray(details?.certifications)
    ? details.certifications.reduce<Record<string, unknown>[]>((items, item) => {
        if (isJsonObject(item)) items.push(item);
        return items;
      }, [])
    : [];
  const rawEquipments: Record<string, unknown>[] = Array.isArray(details?.equipments)
    ? details.equipments.reduce<Record<string, unknown>[]>((items, item) => {
        if (isJsonObject(item)) items.push(item);
        return items;
      }, [])
    : [];

  const certifications: CertificationItem[] = rawCertifications.map((item, index) => {
    const label = readText(item, 'label');
    return {
      id: readText(item, 'id') ?? `cert-${index}`,
      name: readText(item, 'name') ?? label ?? '',
      validity:
        readText(item, 'validity') ??
        readText(item, 'detail') ??
        readText(item, 'expires_at') ??
        '',
      detail:
        readText(item, 'info') ??
        readText(item, 'details') ??
        (label ? '' : (readText(item, 'detail') ?? '')),
    };
  });

  return {
    displayName: identity?.display_name ?? fallbackName,
    jobTitle: fallbackJobTitle,
    phone: details?.phone ?? '',
    zone: details?.zone ?? '',
    certifications,
    equipments: rawEquipments.map((item, index) => ({
      id: readText(item, 'id') ?? `eq-${index}`,
      name: readText(item, 'name') ?? '',
      serial: readText(item, 'serial') ?? '',
      color: 'blue' as const,
    })),
  };
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { membership, role } = useCurrentOrganization();
  const profileQuery = useMyProfile();
  const updateProfile = useUpdateMyProfile();

  const fallbackName =
    (user?.user_metadata?.['display_name'] as string | undefined) ??
    user?.email?.split('@')[0] ??
    '';

  const storedJobTitle =
    typeof window !== 'undefined' ? localStorage.getItem('user_job_title') : null;

  const fallbackJobTitle =
    (user?.user_metadata?.['job_title'] as string | undefined) ??
    (user?.user_metadata?.['jobTitle'] as string | undefined) ??
    membership?.job_title ??
    storedJobTitle ??
    '';

  const remoteProfile = toFormProfile(
    profileQuery.data ?? undefined,
    fallbackName,
    fallbackJobTitle,
  );

  /**
   * Tampon d'édition réactif.
   */
  const [profile, setProfile] = useState<UserProfileData>(remoteProfile);
  const [profileSource, setProfileSource] = useState(profileQuery.data);

  // Ajustement pendant le rendu : évite le rendu intermédiaire avec l'ancienne
  // fiche qu'une synchronisation dans un effet produirait.
  if (profileQuery.data !== profileSource) {
    setProfileSource(profileQuery.data);
    setProfile(remoteProfile);
  }

  const avatarId = profileQuery.data?.identity?.avatar_id ?? null;
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftProfile, setDraftProfile] = useState<UserProfileData>(profile);
  const [savedSuccess, signalerSavedSuccess] = useEphemeralFlag(3000);
  const [submitError, setSubmitError] = useState<unknown>(null);

  // Gestion du mot de passe
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, signalerPasswordSuccess, effacerPasswordSuccess] = useEphemeralFlag(5000);
  const [passwordError, setPasswordError] = useState<unknown>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    effacerPasswordSuccess();

    if (newPassword.length < 6) {
      setPasswordError(new Error('Le nouveau mot de passe doit contenir au moins 6 caractères.'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(new Error('Les deux mots de passe saisis ne correspondent pas.'));
      return;
    }

    setIsChangingPassword(true);
    try {
      await updatePassword(newPassword);
      signalerPasswordSuccess();
      setNewPassword('');
      setConfirmPassword('');
      setIsPasswordModalOpen(false);
    } catch (err) {
      setPasswordError(err);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleOpenModal = () => {
    setDraftProfile(structuredClone(profile));
    setIsModalOpen(true);
  };

  const handleSaveProfile = async (dataToSave: UserProfileData) => {
    setSubmitError(null);
    // Mise à jour instantanée du rendu local
    setProfile(dataToSave);
    setDraftProfile(structuredClone(dataToSave));

    const trimmedJobTitle = dataToSave.jobTitle.trim();
    const trimmedDisplayName = dataToSave.displayName.trim();
    const trimmedPhone = dataToSave.phone.trim();

    // 1. Sauvegarde locale de confort
    try {
      localStorage.setItem('user_job_title', trimmedJobTitle);
    } catch {
      // Stockage inaccessible
    }

    // 2. Synchronisation du poste et du téléphone dans l'organisation courante (grâce à la policy organization_members_update_self)
    if (membership?.id) {
      try {
        await updateOwnMemberContact(membership.id, {
          jobTitle: trimmedJobTitle === '' ? null : trimmedJobTitle,
          phone: trimmedPhone === '' ? null : trimmedPhone,
        });
      } catch (err) {
        console.warn('Synchronisation membership:', err);
      }
    }

    // 3. Sauvegarde sur profiles + user_metadata + profile_details
    updateProfile.mutate(
      {
        identity: { display_name: trimmedDisplayName },
        jobTitle: trimmedJobTitle,
        details: {
          phone: dataToSave.phone.trim() === '' ? null : dataToSave.phone.trim(),
          zone: dataToSave.zone.trim() === '' ? null : dataToSave.zone.trim(),
          certifications: dataToSave.certifications
            .filter((c) => c.name.trim() !== '')
            .map((c) => ({
              id: c.id,
              name: c.name.trim(),
              label: c.name.trim(),
              validity: c.validity.trim(),
              detail: c.validity.trim(),
              info: c.detail.trim(),
            })),
          equipments: dataToSave.equipments
            .filter((eq) => eq.name.trim() !== '')
            .map((eq) => ({
              id: eq.id,
              name: eq.name.trim(),
              serial: eq.serial.trim(),
            })),
        },
      },
      {
        onSuccess: () => {
          signalerSavedSuccess();
        },
        onError: setSubmitError,
      },
    );
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfile(draftProfile);
    void handleSaveProfile(draftProfile);
    setIsModalOpen(false);
  };

  // Helper équipements dans la modale
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

  // Helper habilitations & certifications dans la modale
  const handleAddCertification = () => {
    const newCert: CertificationItem = {
      id: `cert-${Date.now()}`,
      name: '',
      validity: '',
      detail: '',
    };
    setDraftProfile({
      ...draftProfile,
      certifications: [...draftProfile.certifications, newCert],
    });
  };

  const handleRemoveCertification = (id: string) => {
    setDraftProfile({
      ...draftProfile,
      certifications: draftProfile.certifications.filter((c) => c.id !== id),
    });
  };

  const handleUpdateCertification = (
    id: string,
    key: 'name' | 'validity' | 'detail',
    value: string,
  ) => {
    setDraftProfile({
      ...draftProfile,
      certifications: draftProfile.certifications.map((c) =>
        c.id === id ? { ...c, [key]: value } : c,
      ),
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <PageHeader
        title="Profil & Fiche Technicien"
        description="Gérez vos données professionnelles, vos habilitations techniques, votre matériel attribué et vos préférences d'intervention."
      />

      <Card className="border-primary/20 bg-surface-raised text-foreground shadow-raised relative overflow-hidden p-4 sm:p-6">
        <div className="bg-primary/5 pointer-events-none absolute -top-16 -right-12 size-44 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex w-full flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5 md:w-auto">
            <div className="group relative">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="focus-visible:ring-primary/30 relative block cursor-pointer rounded-full focus-visible:ring-4 focus-visible:outline-none"
                title="Changer de photo de profil"
              >
                <UserAvatar
                  avatarId={avatarId}
                  name={profile.displayName}
                  size="lg"
                  className="ring-primary/20 size-20 text-xl font-bold shadow-lg ring-4 transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Camera className="size-5" />
                  <span className="mt-0.5 text-[9px] font-bold">Modifier</span>
                </div>
              </button>
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                  {profile.displayName}
                </h2>
                <Badge
                  variant="outline"
                  className="border-primary/40 bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold"
                >
                  {role ? ROLE_LABELS[role] : 'Compte Professionnel'}
                </Badge>
              </div>
              <p className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <Briefcase className="text-primary size-3.5" />
                {profile.jobTitle || 'Fonction non renseignée'}
              </p>
              <div className="text-muted-foreground grid gap-1.5 pt-1 text-xs sm:flex sm:items-center sm:gap-4">
                <span className="flex items-center gap-1">
                  <MapPin className="text-muted-foreground size-3" />
                  {profile.zone || 'Zone non renseignée'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="text-muted-foreground size-3" />
                  Membre depuis : {user?.created_at ? formatDate(user.created_at) : 'Compte actif'}
                </span>
              </div>
            </div>
          </div>

          <div className="border-border flex w-full flex-col items-stretch gap-2 border-t pt-4 sm:flex-row md:w-auto md:flex-col md:items-stretch md:border-t-0 md:pt-0">
            <Button
              variant="outline"
              onClick={() => setIsAvatarModalOpen(true)}
              leadingIcon={<Sparkles />}
              className="md:min-w-48"
            >
              Changer d'avatar
            </Button>
            <Button
              variant="primary"
              onClick={() => handleSaveProfile(profile)}
              isLoading={updateProfile.isPending}
              loadingLabel="Enregistrement du profil"
              leadingIcon={<Save />}
              className="md:min-w-48"
            >
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

      {/* Sections du Profil (Empilées harmonieusement) */}
      <div className="space-y-6">
        {/* Card 1 : Coordonnées Professionnelles */}
        <Card className="overflow-hidden">
          <CardHeader className="border-border bg-surface-sunken/35 border-b">
            <div className="flex items-start gap-3">
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <User className="size-4" />
              </span>
              <div className="min-w-0 space-y-1">
                <CardTitle>Informations & Coordonnées</CardTitle>
                <CardDescription>
                  Identité et informations de contact utilisées sur vos PV d'intervention et fiches
                  de mission.
                </CardDescription>
              </div>
            </div>
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
              <Input
                id="profile-email-readonly"
                label="Adresse e-mail du compte"
                type="email"
                value={user?.email ?? ''}
                readOnly
                leadingIcon={<Mail />}
                trailingSlot={
                  <span className="border-success/20 bg-success/10 text-2xs text-success rounded-md border px-2 py-0.5 font-semibold whitespace-nowrap">
                    Vérifiée
                  </span>
                }
                className="pr-20"
              />

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
        <Card className="overflow-hidden">
          <CardHeader className="border-border bg-surface-sunken/35 flex flex-col items-stretch justify-between gap-4 border-b sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="bg-warning/10 text-warning flex size-10 shrink-0 items-center justify-center rounded-lg">
                <HardHat className="size-4" />
              </span>
              <div className="min-w-0 space-y-1">
                <CardTitle>Habilitations & Matériel Attribué</CardTitle>
                <CardDescription>
                  Accréditations électriques, diplômes de sécurité et outillage de mesure
                  enregistrés sur votre profil.
                </CardDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenModal}
              leadingIcon={<Pencil />}
              className="shrink-0"
            >
              Modifier
            </Button>
          </CardHeader>

          <CardContent className="space-y-6 pt-5">
            {/* Habilitations */}
            <div>
              <h4 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                <ShieldCheck className="text-success size-3.5" />
                Habilitations & Certifications Sécurité (
                {profile.certifications.filter((c) => c.name.trim() !== '').length})
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {profile.certifications
                  .filter((c) => c.name.trim() !== '')
                  .map((cert) => {
                    const isElec =
                      cert.name.toLowerCase().includes('elec') ||
                      cert.name.toLowerCase().includes('h0') ||
                      cert.name.toLowerCase().includes('b2') ||
                      cert.name.toLowerCase().includes('br') ||
                      cert.name.toLowerCase().includes('bc');
                    const isCaces =
                      cert.name.toLowerCase().includes('caces') ||
                      cert.name.toLowerCase().includes('nacelle') ||
                      cert.name.toLowerCase().includes('pemp');

                    return (
                      <div
                        key={cert.id}
                        className="border-border bg-surface-raised hover:border-primary/35 hover:shadow-raised flex items-start gap-3 rounded-xl border p-3 transition-[border-color,box-shadow,transform] motion-reduce:hover:translate-y-0 sm:hover:-translate-y-0.5"
                      >
                        {isElec ? (
                          <Zap className="text-warning mt-0.5 size-5 shrink-0" />
                        ) : isCaces ? (
                          <Award className="text-primary mt-0.5 size-5 shrink-0" />
                        ) : (
                          <ShieldCheck className="text-success mt-0.5 size-5 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground truncate text-xs font-semibold">
                            {cert.name}
                          </p>
                          <p className="text-2xs text-muted-foreground mt-0.5 font-medium">
                            {cert.validity || 'Validité permanente'}
                          </p>
                          {cert.detail.trim() !== '' && (
                            <p className="text-3xs text-subtle-foreground mt-1 line-clamp-1">
                              {cert.detail}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {profile.certifications.filter((c) => c.name.trim() !== '').length === 0 && (
                  <p className="text-subtle-foreground col-span-2 text-xs italic">
                    Aucune habilitation enregistrée. Cliquez sur "Modifier" pour en ajouter
                    (H0V/B2V, CACES, SST, AIPR...).
                  </p>
                )}
              </div>
            </div>

            {/* Équipements attribués */}
            <div className="border-border border-t pt-4">
              <h4 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                <Wrench className="text-primary size-3.5" />
                Équipements & Instruments de Mesure Détenus
              </h4>

              {profile.equipments.filter((eq) => eq.name.trim() !== '').length > 0 ? (
                <div className="space-y-2.5">
                  {profile.equipments
                    .filter((eq) => eq.name.trim() !== '')
                    .map((eq, index) => {
                      const dotColor =
                        index % 3 === 0
                          ? 'bg-primary'
                          : index % 3 === 1
                            ? 'bg-success'
                            : 'bg-warning';

                      return (
                        <div
                          key={eq.id}
                          className="border-border bg-surface-raised hover:border-primary/25 flex flex-col items-start justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs transition-colors sm:flex-row sm:items-center"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`size-2 rounded-full ${dotColor}`} />
                            <span className="text-foreground font-medium">{eq.name}</span>
                          </div>
                          {eq.serial.trim() !== '' ? (
                            <span className="bg-surface-raised text-2xs text-muted-foreground rounded px-2 py-0.5 font-mono">
                              S/N: {eq.serial}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-subtle-foreground text-xs italic">
                  Aucun équipement de mesure enregistré. Cliquez sur "Modifier" pour en déclarer.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3 : Sécurité du Compte & Mot de Passe */}
        <Card className="overflow-hidden">
          <CardHeader className="border-border bg-surface-sunken/35 flex flex-col items-stretch justify-between gap-4 border-b sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Lock className="size-4" />
              </span>
              <div className="min-w-0 space-y-1">
                <CardTitle>Sécurité du Compte & Mot de Passe</CardTitle>
                <CardDescription>
                  Protégez l'accès à votre espace REZO360 avec un mot de passe robuste.
                </CardDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPasswordError(null);
                setIsPasswordModalOpen(true);
              }}
              leadingIcon={<KeyRound />}
              className="shrink-0"
            >
              Modifier le mot de passe
            </Button>
          </CardHeader>

          <CardContent className="pt-5">
            {passwordSuccess ? (
              <div
                className="border-success/30 bg-success/10 text-success animate-in fade-in flex items-center gap-2 rounded-lg border p-3 text-xs"
                role="status"
              >
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Votre mot de passe a été mis à jour avec succès.</span>
              </div>
            ) : (
              <div className="text-muted-foreground flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-success size-2 rounded-full" />
                  <span>Authentification sécurisée active (Supabase Auth)</span>
                </div>
                <span className="text-2xs text-subtle-foreground font-mono">••••••••••••</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal d'édition des Habilitations & Équipements */}
      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Gérer les habilitations & équipements"
        description="Modifiez ou ajoutez les matériels de mesure et habilitations attribués à votre fiche technicien."
        size="lg"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              form="profile-equipment-form"
              variant="primary"
              leadingIcon={<Check />}
              className="w-full font-semibold sm:w-auto"
            >
              Enregistrer
            </Button>
          </div>
        }
      >
        <form id="profile-equipment-form" onSubmit={handleModalSubmit} className="space-y-5">
          {/* Section Équipements */}
          <div className="space-y-3">
            <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
              <h4 className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                <Wrench className="text-primary size-3.5" />
                Équipements & Instruments de Mesure
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddEquipment}
                leadingIcon={<Plus />}
                className="text-primary hover:text-primary-hover"
              >
                Ajouter un matériel
              </Button>
            </div>

            <div className="space-y-2.5">
              {draftProfile.equipments.length === 0 ? (
                <p className="text-muted-foreground border-border rounded-lg border border-dashed py-4 text-center text-xs italic">
                  Aucun équipement renseigné. Cliquez sur « Ajouter un matériel » ci-dessus.
                </p>
              ) : (
                draftProfile.equipments.map((eq) => (
                  <div
                    key={eq.id}
                    className="border-border bg-surface-raised flex items-start gap-2 rounded-lg border p-2.5"
                  >
                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="Nom de l'équipement (ex: Réflectomètre, Soudeuse...)"
                        value={eq.name}
                        onChange={(e) => handleUpdateEquipment(eq.id, 'name', e.target.value)}
                      />
                      <Input
                        placeholder="Matricule / S/N"
                        value={eq.serial}
                        onChange={(e) => handleUpdateEquipment(eq.id, 'serial', e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveEquipment(eq.id)}
                      className="text-muted-foreground hover:text-error shrink-0"
                      aria-label={`Supprimer l'équipement ${eq.name || 'sans nom'}`}
                      title="Supprimer cet équipement"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section Habilitations & Certifications */}
          <div className="border-border space-y-3 border-t pt-4">
            <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
              <h4 className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                <ShieldCheck className="text-success size-3.5" />
                Habilitations Électriques & Sécurité
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddCertification}
                leadingIcon={<Plus />}
                className="text-primary hover:text-primary-hover"
              >
                Ajouter une habilitation
              </Button>
            </div>

            <div className="space-y-3">
              {draftProfile.certifications.length === 0 ? (
                <p className="text-muted-foreground border-border rounded-lg border border-dashed py-4 text-center text-xs italic">
                  Aucune habilitation enregistrée. Cliquez sur « Ajouter une habilitation »
                  ci-dessus.
                </p>
              ) : (
                draftProfile.certifications.map((cert, index) => (
                  <div
                    key={cert.id}
                    className="border-border bg-surface-raised space-y-2.5 rounded-lg border p-3"
                  >
                    <div className="border-border/50 flex items-center justify-between border-b pb-1">
                      <span className="text-2xs text-muted-foreground font-bold tracking-wider uppercase">
                        Habilitation #{index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveCertification(cert.id)}
                        className="text-muted-foreground hover:text-error shrink-0"
                        aria-label={`Supprimer l'habilitation ${cert.name || String(index + 1)}`}
                        title="Supprimer cette habilitation"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <Input
                        label="Habilitation (Nom / Niveau)"
                        placeholder="ex: H0V / B2V, CACES R486, SST, AIPR..."
                        value={cert.name}
                        onChange={(e) => handleUpdateCertification(cert.id, 'name', e.target.value)}
                      />
                      <Input
                        label="Date / Validité"
                        placeholder="ex: Valide jusqu'en Novembre 2027"
                        value={cert.validity}
                        onChange={(e) =>
                          handleUpdateCertification(cert.id, 'validity', e.target.value)
                        }
                      />
                    </div>
                    <Input
                      label="Détail ou organisme"
                      placeholder="ex: Intervention Pylônes & Nacelles, Bureau Veritas, SST..."
                      value={cert.detail}
                      onChange={(e) => handleUpdateCertification(cert.id, 'detail', e.target.value)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* Modale de Modification du Mot de Passe */}
      <Modal
        open={isPasswordModalOpen}
        onOpenChange={setIsPasswordModalOpen}
        title="Modifier votre mot de passe"
        description="Saisissez votre nouveau mot de passe contenant au moins 6 caractères pour sécuriser votre compte."
        size="md"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPasswordModalOpen(false)}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              form="profile-password-form"
              variant="primary"
              disabled={newPassword.trim() === ''}
              isLoading={isChangingPassword}
              loadingLabel="Enregistrement du mot de passe"
              leadingIcon={<KeyRound />}
              className="w-full font-semibold sm:w-auto"
            >
              Enregistrer le mot de passe
            </Button>
          </div>
        }
      >
        <form id="profile-password-form" onSubmit={handleChangePassword} className="space-y-4">
          <FormError error={passwordError} />

          <div>
            <label
              htmlFor="modal-new-password"
              className="text-muted-foreground mb-1.5 block text-xs font-medium"
            >
              Nouveau mot de passe
            </label>
            <div className="relative flex items-center">
              <input
                id="modal-new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                required
                minLength={6}
                autoComplete="new-password"
                className="h-touch border-border-strong bg-surface text-foreground placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:ring-primary w-full rounded-md border px-3 pr-12 text-sm focus-visible:ring-2 focus-visible:outline-none sm:h-9"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="size-touch text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:ring-primary absolute right-0 flex cursor-pointer items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none sm:size-9"
                aria-label={
                  showNewPassword
                    ? 'Masquer le nouveau mot de passe'
                    : 'Afficher le nouveau mot de passe'
                }
                title={showNewPassword ? 'Masquer' : 'Afficher'}
              >
                {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="modal-confirm-password"
              className="text-muted-foreground mb-1.5 block text-xs font-medium"
            >
              Confirmer le nouveau mot de passe
            </label>
            <div className="relative flex items-center">
              <input
                id="modal-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                required
                minLength={6}
                autoComplete="new-password"
                className="h-touch border-border-strong bg-surface text-foreground placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:ring-primary w-full rounded-md border px-3 pr-12 text-sm focus-visible:ring-2 focus-visible:outline-none sm:h-9"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="size-touch text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:ring-primary absolute right-0 flex cursor-pointer items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none sm:size-9"
                aria-label={
                  showConfirmPassword
                    ? 'Masquer la confirmation du mot de passe'
                    : 'Afficher la confirmation du mot de passe'
                }
                title={showConfirmPassword ? 'Masquer' : 'Afficher'}
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Sélection d'avatar */}
      <AvatarPicker open={isAvatarModalOpen} onOpenChange={setIsAvatarModalOpen} />
    </div>
  );
}
