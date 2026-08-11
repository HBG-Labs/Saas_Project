import { UserPlus, UserCheck, Key, Copy, Check } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { FormError } from '@/components/feedback/FormError';
import type { OrgRole } from '@/types/database';
import type { MemberWithProfile } from '@/types/domain';

import { RoleSelect } from './RoleSelect';
import { saveLocalMember } from '../api/organizations.api';

export interface AddMemberDialogProps {
  organizationId: string;
  viewerIsOwner: boolean;
  quotaReached: boolean;
  onMemberAdded?: () => void;
}

export function AddMemberDialog({
  organizationId,
  viewerIsOwner,
  quotaReached,
  onMemberAdded,
}: AddMemberDialogProps) {
  const [open, setOpen] = useState(false);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Nexora2026!');
  const [jobTitle, setJobTitle] = useState('Technicien Terrain');
  const [role, setRole] = useState<OrgRole>('technician');
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [createdMember, setCreatedMember] = useState<{ member: MemberWithProfile; pass: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let res = 'NX-';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(res);
  };

  const handleSubmitDirect = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!name.trim()) {
      setSubmitError(new Error('Le nom complet est obligatoire.'));
      return;
    }

    try {
      const newMember: MemberWithProfile = {
        id: `mem-${Date.now()}`,
        organization_id: organizationId,
        user_id: `user-${Date.now()}`,
        role,
        status: 'active',
        job_title: jobTitle || 'Technicien Terrain',
        joined_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profile: {
          id: `prof-${Date.now()}`,
          display_name: name,
          avatar_url: null,
        },
      };

      saveLocalMember(newMember);
      setCreatedMember({ member: newMember, pass: password });
      if (onMemberAdded) onMemberAdded();
    } catch (err) {
      setSubmitError(err);
    }
  };

  const copyCredentials = () => {
    if (!createdMember) return;
    const text = `Accès NexoraTech:\nNom: ${createdMember.member.profile?.display_name}\nIdentifiant/Email: ${email || createdMember.member.profile?.display_name?.toLowerCase().replace(/\s+/g, '.') + '@entreprise.fr'}\nMot de passe: ${createdMember.pass}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setCreatedMember(null);
      setSubmitError(null);
      setName('');
      setEmail('');
      setPassword('Nexora2026!');
      setJobTitle('Technicien Terrain');
      setRole('technician');
      setCopied(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={createdMember ? 'Technicien créé & Identifiants générés' : 'Ajouter un technicien / membre'}
      description={
        createdMember
          ? 'Transmettez ces identifiants d’accès provisoires à votre collaborateur.'
          : 'Créez directement le compte et attribuez un mot de passe d’accès à votre technicien.'
      }
      trigger={
        <Button variant="primary" size="sm" disabled={quotaReached}>
          <UserPlus className="size-4" />
          + Ajouter un membre
        </Button>
      }
    >
      {createdMember ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-slate-100">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-base">
              <UserCheck className="size-5" />
              <span>{createdMember.member.profile?.display_name}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Poste : <strong>{createdMember.member.job_title}</strong> — Rôle : <strong>{role}</strong>
            </p>

            <div className="mt-4 space-y-2 rounded-lg bg-slate-900/90 p-3 font-mono text-xs border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Identifiant / Email :</span>
                <span className="text-slate-200 font-semibold">
                  {email || `${createdMember.member.profile?.display_name?.toLowerCase().replace(/\s+/g, '.')}@entreprise.fr`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mot de passe provisoire :</span>
                <span className="text-emerald-400 font-bold tracking-wider">{createdMember.pass}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={copyCredentials}
            >
              {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
              {copied ? 'Copié !' : 'Copier les accès'}
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => close(false)}
            >
              Terminer
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmitDirect} className="space-y-4">
          <FormError error={submitError} />

          <Input
            label="Nom complet du technicien"
            placeholder="ex: Kevin Moreau"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Poste / Métier"
            placeholder="ex: Technicien Fibre Optique, Électricien, Chef d'équipe..."
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />

          <Input
            label="Adresse e-mail (facultative)"
            type="email"
            placeholder="technicien@entreprise.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Key className="size-3.5 text-amber-400" />
                Mot de passe provisoire attribué
              </label>
              <button
                type="button"
                onClick={generatePassword}
                className="text-2xs text-blue-400 hover:underline cursor-pointer"
              >
                Générer un mot de passe
              </button>
            </div>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe provisoire"
              required
            />
          </div>

          <RoleSelect value={role} onChange={setRole} canAssignOwner={viewerIsOwner} />

          <Button type="submit" variant="primary" className="w-full">
            Créer le compte & Générer les accès
          </Button>
        </form>
      )}
    </Modal>
  );
}
