import { Check, Copy, KeyRound, UserCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { OrgRole } from '@/types/database';

import type { CreatedMemberAccount } from '../api/organizations.api';
import { useCreateMemberAccount } from '../hooks/useMembers';
import { ROLE_LABELS } from '../rbac';

import { RoleSelect } from './RoleSelect';

export interface AddMemberDialogProps {
  organizationId: string;
  viewerIsOwner: boolean;
  quotaReached: boolean;
  onMemberAdded?: () => void;
}

/**
 * Crée directement le compte d'un collaborateur.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UN SEUL CHEMIN ICI, L'INVITATION EST AILLEURS
 *
 * Cette boîte ne fait qu'une chose : créer le compte et remettre ses accès.
 * L'invitation par courriel a sa propre entrée, `InviteMemberDialog`, sur le
 * même écran. Proposer les deux ici les dupliquait — la page offrait deux fois
 * le même geste, à deux endroits, et il fallait comparer les libellés pour
 * comprendre lequel faisait quoi.
 *
 * Les deux chemins mènent au même résultat : l'employé obtient son PROPRE compte
 * `auth.users`, son profil et son rôle. Aucun ne fait de lui un souscripteur —
 * il travaille sous l'abonnement de l'entreprise. Ils diffèrent sur un point,
 * qui suffit à justifier leur coexistence :
 *
 *   ICI              — le dirigeant fixe les accès et les remet en main propre.
 *                      Indispensable quand le courriel n'est pas une option :
 *                      technicien sans adresse professionnelle, messagerie non
 *                      configurée, ou personne assise en face de soi.
 *
 *   INVITATION       — la personne s'inscrit elle-même et choisit son mot de
 *                      passe. Personne d'autre ne le connaît jamais.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function AddMemberDialog({
  organizationId,
  viewerIsOwner,
  quotaReached,
  onMemberAdded,
}: AddMemberDialogProps) {
  const [open, setOpen] = useState(false);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<OrgRole>('technician');

  const [submitError, setSubmitError] = useState<unknown>(null);
  const [account, setAccount] = useState<CreatedMemberAccount | null>(null);
  const [copied, setCopied] = useState(false);

  const createAccount = useCreateMemberAccount(organizationId);

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const address = email.trim();
    if (address === '') {
      setSubmitError(new Error("L'adresse e-mail sert d'identifiant de connexion."));
      return;
    }

    createAccount.mutate(
      {
        email: address,
        role,
        ...(displayName.trim() !== '' ? { displayName: displayName.trim() } : {}),
        ...(jobTitle.trim() !== '' ? { jobTitle: jobTitle.trim() } : {}),
        // Champ laissé vide : le serveur produit un mot de passe solide et
        // dictable. Mieux vaut cela qu'un « Nexora2026! » réutilisé partout.
        ...(password.trim() !== '' ? { password: password.trim() } : {}),
      },
      {
        onSuccess: (created) => {
          setAccount(created);
          onMemberAdded?.();
        },
        onError: setSubmitError,
      },
    );
  };

  const copyCredentials = () => {
    if (account === null) return;

    void navigator.clipboard
      .writeText(
        `Accès NexoraTech\nIdentifiant : ${account.email}\nMot de passe provisoire : ${account.password}`,
      )
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Hors contexte sécurisé, l'écriture presse-papiers est refusée. Le
        // texte reste sélectionnable : inutile d'alarmer.
      });
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setAccount(null);
      setSubmitError(null);
      setEmail('');
      setDisplayName('');
      setJobTitle('');
      setPassword('');
      setCopied(false);
      setRole('technician');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={account === null ? 'Créer le compte d’un collaborateur' : 'Compte créé'}
      description={
        account === null
          ? 'Le compte est actif immédiatement et vous en remettez les accès. Pour que la personne choisisse elle-même son mot de passe, utilisez plutôt « Inviter un membre ».'
          : 'Transmettez ces accès à votre collaborateur. Le mot de passe ne sera plus affiché après fermeture.'
      }
      trigger={
        <Button variant="primary" size="sm" disabled={quotaReached}>
          <UserPlus className="size-4" />
          <span>Créer un compte</span>
        </Button>
      }
    >
      {account !== null ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 text-base font-semibold text-emerald-600 dark:text-emerald-400">
              <UserCheck className="size-5" />
              <span>{displayName.trim() === '' ? account.email : displayName}</span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Rôle attribué : <strong>{ROLE_LABELS[role]}</strong>
              {jobTitle.trim() !== '' && <> — {jobTitle}</>}
            </p>

            <dl className="border-border/60 bg-surface-sunken/60 mt-3 space-y-1.5 rounded-lg border p-3 font-mono text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Identifiant</dt>
                <dd className="text-foreground font-semibold break-all">{account.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Mot de passe</dt>
                <dd className="font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                  {account.password}
                </dd>
              </div>
            </dl>
          </div>

          <p className="text-muted-foreground text-2xs leading-relaxed">
            Ce mot de passe est provisoire et n’est affiché qu’une fois. Invitez votre
            collaborateur à le changer depuis son profil — ou à utiliser « mot de passe oublié »,
            qui fonctionne dès maintenant sur cette adresse.
          </p>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={copyCredentials}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Copié' : 'Copier les accès'}
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => close(false)}>
              Terminer
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreate} className="space-y-4">
          <FormError error={submitError} />

          <Input
            label="Adresse e-mail (servira d’identifiant)"
            type="email"
            placeholder="technicien@entreprise.fr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Nom complet"
              placeholder="ex : Kevin Moreau"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <Input
              label="Poste"
              placeholder="ex : Technicien fibre"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
            />
          </div>

          <Input
            label="Mot de passe provisoire (laisser vide pour en générer un)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Généré automatiquement si vide"
          />

          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Le compte est actif immédiatement, sans confirmation par courriel. Vous remettez les
              accès vous-même — ils ne s’affichent qu’une fois.
            </span>
          </p>

          <RoleSelect value={role} onChange={setRole} canAssignOwner={viewerIsOwner} />

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={createAccount.isPending}
          >
            {createAccount.isPending ? 'Création du compte…' : 'Créer le compte'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
