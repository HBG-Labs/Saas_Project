import { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Award,
  Wrench,
  CheckCircle2,
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
} from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/features/auth';
import { formatDate } from '@/lib/format';

const STORAGE_PROFILE_KEY = 'nexoratech_user_profile_custom';

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

export default function ProfilePage() {
  const { user } = useAuth();

  const initialName =
    (user?.user_metadata['display_name'] as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Stéphane Leduc';

  // Charger profil personnalisé depuis localStorage avec fallback propre
  const [profile, setProfile] = useState<UserProfileData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PROFILE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_PROFILE,
          ...parsed,
          displayName: parsed.displayName || initialName,
          equipments: Array.isArray(parsed.equipments) ? parsed.equipments : DEFAULT_PROFILE.equipments,
        };
      }
    } catch {
      // Fallback
    }
    return { ...DEFAULT_PROFILE, displayName: initialName };
  });

  // État local de la modale pour édition
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftProfile, setDraftProfile] = useState<UserProfileData>(profile);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Synchroniser le draft lorsque la modale s'ouvre
  const handleOpenModal = () => {
    setDraftProfile(JSON.parse(JSON.stringify(profile)));
    setIsModalOpen(true);
  };

  // Sauvegarder les modifications générales du profil
  const handleSaveProfile = (dataToSave: UserProfileData = profile) => {
    try {
      localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(dataToSave));
      setProfile(dataToSave);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      // Storage fallback
    }
  };

  // Validation et enregistrement depuis la modale
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

      {/* Header Banner - Executive Technician Identity */}
      <Card className="relative overflow-hidden border-border bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-800 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-blue-600/10 to-transparent" />

        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar
                name={profile.displayName}
                size="lg"
                className="size-20 text-xl font-bold ring-4 ring-blue-500/30 shadow-lg"
              />
              <span
                className="absolute right-0 bottom-0 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-3xs text-white ring-2 ring-slate-900"
                title="Disponible pour intervention"
              >
                ✓
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-white">{profile.displayName}</h2>
                <Badge
                  variant="outline"
                  className="border-blue-400/40 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-300"
                >
                  Administrateur & Expert Terrain
                </Badge>
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300"
                >
                  🟢 En service
                </Badge>
              </div>
              <p className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Briefcase className="size-3.5 text-blue-400" />
                {profile.jobTitle}
              </p>
              <div className="flex items-center gap-4 pt-1 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 text-slate-400" />
                  {profile.zone}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3 text-slate-400" />
                  Membre depuis : {user?.created_at ? formatDate(user.created_at) : '9 août 2026'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex w-full items-center gap-3 border-t border-slate-700/60 pt-4 md:w-auto md:border-t-0 md:pt-0">
            <Button
              variant="primary"
              onClick={() => handleSaveProfile(profile)}
              className="cursor-pointer gap-2 bg-blue-600 font-medium text-white shadow-md hover:bg-blue-500"
            >
              <Save className="size-4" />
              {savedSuccess ? 'Enregistré !' : 'Sauvegarder le profil'}
            </Button>
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
                <User className="size-4 text-blue-400" />
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
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Adresse e-mail (Compte)
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3 size-4 text-slate-400" />
                    <input
                      type="email"
                      value={user?.email ?? 'leduc972@live.fr'}
                      readOnly
                      disabled
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 py-2 pr-24 pl-9 text-sm text-slate-300 opacity-80 cursor-not-allowed"
                    />
                    <span className="absolute right-2 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-2xs font-semibold text-emerald-400">
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
                  <HardHat className="size-4 text-amber-400" />
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
                <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
                  <ShieldCheck className="size-3.5 text-emerald-400" />
                  Habilitations & Certifications Sécurité
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {profile.habElec.trim() !== '' ? (
                    <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                      <Zap className="mt-0.5 size-5 shrink-0 text-amber-400" />
                      <div>
                        <p className="text-xs font-semibold text-white">{profile.habElec}</p>
                        <p className="mt-0.5 text-2xs text-slate-400">{profile.habElecExpiry || "Valide"}</p>
                      </div>
                    </div>
                  ) : null}

                  {profile.habCaces.trim() !== '' ? (
                    <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                      <Award className="mt-0.5 size-5 shrink-0 text-blue-400" />
                      <div>
                        <p className="text-xs font-semibold text-white">{profile.habCaces}</p>
                        <p className="mt-0.5 text-2xs text-slate-400">{profile.habCacesInfo || "Intervention Nacelle"}</p>
                      </div>
                    </div>
                  ) : null}

                  {profile.habElec.trim() === '' && profile.habCaces.trim() === '' ? (
                    <p className="col-span-2 text-xs italic text-slate-500">
                      Aucune habilitation enregistrée. Cliquez sur "Modifier" pour en ajouter une.
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Équipements attribués */}
              <div className="border-t border-slate-800/80 pt-4">
                <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
                  <Wrench className="size-3.5 text-blue-400" />
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
                            className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/30 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`size-2 rounded-full ${dotColor}`} />
                              <span className="font-medium text-slate-200">{eq.name}</span>
                            </div>
                            {eq.serial.trim() !== '' ? (
                              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-2xs text-slate-400">
                                S/N: {eq.serial}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-xs italic text-slate-500">
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
          <Card className="border-blue-500/20 bg-gradient-to-b from-slate-900 to-slate-950">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Activity className="size-4 text-emerald-400" />
                Performance 30 Jours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                <div className="space-y-0.5">
                  <p className="text-2xs font-semibold tracking-wider text-emerald-400 uppercase">
                    Missions Réalisées
                  </p>
                  <p className="text-xl font-bold text-white">48 missions</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400">
                  <Star className="size-3.5 fill-current" /> 98.2%
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <span className="block text-2xs text-slate-400">Temps moyen</span>
                  <span className="text-sm font-bold text-white">1h 35min</span>
                </div>
                <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <span className="block text-2xs text-slate-400">PV Signés</span>
                  <span className="flex items-center gap-1 text-sm font-bold text-emerald-400">
                    <FileCheck className="size-3.5" /> 42 validés
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-2xs text-slate-400">
                <div className="flex justify-between font-medium text-slate-300">
                  <span>Satisfaction Client</span>
                  <span className="font-bold text-amber-400">4.9 / 5.0 ★</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-[98%] rounded-full bg-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4 : Identifiants Techniques & Sécurité */}
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Smartphone className="size-4 text-purple-400" />
                Identifiants & Sécurité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5 text-xs">
              <div>
                <p className="text-subtle-foreground text-2xs font-semibold tracking-wider uppercase">
                  Identifiant Unique Supabase (UUID)
                </p>
                <p className="mt-1 rounded border border-slate-800 bg-slate-900 p-2 font-mono text-2xs text-slate-300 break-all select-all">
                  {user?.id ?? 'c208bc1c-68a1-48be-8bb7-ca96555a13be'}
                </p>
              </div>

              <div>
                <p className="text-subtle-foreground text-2xs font-semibold tracking-wider uppercase">
                  Type de compte & Rôle
                </p>
                <div className="mt-1 flex items-center justify-between rounded border border-slate-800 bg-slate-900/50 p-2">
                  <span className="font-medium text-slate-200">Administrateur Technique</span>
                  <span className="text-2xs font-semibold text-blue-400">Accès global</span>
                </div>
              </div>

              <div>
                <p className="text-subtle-foreground text-2xs font-semibold tracking-wider uppercase">
                  Application Mobile Enregistrée
                </p>
                <div className="mt-1 flex items-center justify-between rounded border border-slate-800 bg-slate-900/50 p-2">
                  <span className="font-medium text-slate-200">Android App (SM-G990B)</span>
                  <span className="text-2xs font-semibold text-emerald-400">🟢 Connectée</span>
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
              <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-300 uppercase">
                <Wrench className="size-3.5 text-blue-400" />
                Équipements & Instruments de Mesure
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddEquipment}
                className="cursor-pointer gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                <Plus className="size-3.5" /> Ajouter un matériel
              </Button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {draftProfile.equipments.map((eq, idx) => (
                <div key={eq.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
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
                    className="cursor-pointer text-slate-400 hover:text-rose-400 shrink-0"
                    title="Supprimer cet équipement"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Section Habilitations */}
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-300 uppercase">
              <ShieldCheck className="size-3.5 text-emerald-400" />
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
          <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
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
    </div>
  );
}
