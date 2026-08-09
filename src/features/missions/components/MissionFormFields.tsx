import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CustomerPicker, SitePicker } from '@/features/customers';
import type { MissionPriority } from '@/types/database';

import { MISSION_PRIORITY_LABELS } from '../priority-labels';
import type { MissionValues } from '../schemas/mission.schema';

export interface MissionFormFieldsProps {
  register: UseFormRegister<MissionValues>;
  errors: FieldErrors<MissionValues>;
  organizationId: string | null;

  priority: MissionPriority;
  onPriorityChange: (priority: MissionPriority) => void;

  customerId: string | null;
  onCustomerChange: (customerId: string | null) => void;

  siteId: string | null;
  onSiteChange: (siteId: string | null) => void;
}

/**
 * Champs communs à la création et à l'édition d'une mission.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE COMPOSANT EXISTE
 *
 * La création se fait sur une page dédiée, l'édition dans une fenêtre : deux
 * contextes, deux mises en page. Mais les CHAMPS sont les mêmes, et deux
 * formulaires jumeaux divergent toujours — l'un gagne un champ que l'autre
 * n'aura jamais, et l'on découvre des mois plus tard qu'on ne peut pas corriger
 * ce qu'on peut saisir.
 *
 * Chaque appelant fournit son propre habillage — cartes sur la page, sections
 * simples dans la fenêtre — et partage cette liste.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function MissionFormFields({
  register,
  errors,
  organizationId,
  priority,
  onPriorityChange,
  customerId,
  onCustomerChange,
  siteId,
  onSiteChange,
}: MissionFormFieldsProps) {
  return (
    <>
      <Input
        label="Intitulé"
        placeholder="Raccordement FTTH — armoire de rue"
        required
        {...(errors.title?.message ? { error: errors.title.message } : {})}
        {...register('title')}
      />

      <Textarea
        label="Description"
        rows={3}
        placeholder="Nature des travaux, matériel attendu, contraintes particulières."
        {...register('description')}
      />

      <Select
        options={Object.entries(MISSION_PRIORITY_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
        value={priority}
        onValueChange={(value) => {
          onPriorityChange(value as MissionPriority);
        }}
        label="Priorité"
      />

      {/*
        Choisir un site suffit : le trigger en déduit le client et recopie
        l'adresse et les consignes d'accès. Changer de client remet le site à
        zéro — un site appartient à un client, et la base refuse le couple
        incohérent.
      */}
      <CustomerPicker
        organizationId={organizationId}
        value={customerId}
        onChange={(next) => {
          onCustomerChange(next);
          onSiteChange(null);
        }}
      />

      <SitePicker customerId={customerId} value={siteId} onChange={onSiteChange} />

      <Input
        label="Précision de lieu"
        placeholder="Armoire PM 12, trottoir pair"
        hint="Complète l’adresse du site — laissez vide pour reprendre celle du site."
        {...register('locationLabel')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Début prévu"
          type="datetime-local"
          {...(errors.scheduledStart?.message ? { error: errors.scheduledStart.message } : {})}
          {...register('scheduledStart')}
        />
        <Input
          label="Fin prévue"
          type="datetime-local"
          {...(errors.scheduledEnd?.message ? { error: errors.scheduledEnd.message } : {})}
          {...register('scheduledEnd')}
        />
      </div>

      <Textarea label="Notes internes" rows={2} {...register('notes')} />
    </>
  );
}
