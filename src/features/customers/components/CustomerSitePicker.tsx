import { Select } from '@/components/ui/Select';

import { useCustomerSites } from '../hooks/useCustomerChildren';
import { useCustomers } from '../hooks/useCustomers';

/**
 * Sélecteurs client et site, destinés au formulaire de mission (Phase 6).
 *
 * Ils vivent ici et non dans le module Missions parce que la règle qu'ils
 * portent appartient au domaine Clients : un site dépend d'un client, et le
 * choix du second doit réinitialiser le premier. Cette dépendance existe aussi
 * en base — le trigger `enforce_mission_customer_site` refuse un site
 * n'appartenant pas au client de la mission.
 *
 * Construits sur `Select` plutôt que sur une liste déroulante avec recherche :
 * au-delà de quelques dizaines de clients il faudra une vraie combobox, mais
 * l'écrire aujourd'hui serait la deviner. Le remplacement se fera derrière cette
 * interface, sans toucher aux appelants.
 */

export interface CustomerPickerProps {
  organizationId: string | null;
  value: string | null;
  onChange: (customerId: string | null) => void;
  label?: string;
  disabled?: boolean;
}

export function CustomerPicker({
  organizationId,
  value,
  onChange,
  label = 'Client',
  disabled = false,
}: CustomerPickerProps) {
  const customers = useCustomers(organizationId);

  const options = (customers.data ?? []).map((customer) => ({
    value: customer.id,
    label: `${customer.name} · ${customer.reference}`,
  }));

  return (
    <Select
      options={options}
      {...(value !== null ? { value } : {})}
      onValueChange={onChange}
      label={label}
      placeholder={customers.isPending ? 'Chargement…' : 'Aucun client sélectionné'}
      hint="Facultatif — une intervention d’urgence peut se passer de fiche client."
      disabled={disabled || customers.isPending}
    />
  );
}

export interface SitePickerProps {
  /** `null` désactive le sélecteur : un site n'existe pas sans client. */
  customerId: string | null;
  value: string | null;
  onChange: (siteId: string | null) => void;
  label?: string;
  disabled?: boolean;
}

export function SitePicker({
  customerId,
  value,
  onChange,
  label = 'Site d’intervention',
  disabled = false,
}: SitePickerProps) {
  const sites = useCustomerSites(customerId ?? undefined);

  const options = (sites.data ?? []).map((site) => ({
    value: site.id,
    label: site.city !== null && site.city !== '' ? `${site.name} — ${site.city}` : site.name,
  }));

  return (
    <Select
      options={options}
      {...(value !== null ? { value } : {})}
      onValueChange={onChange}
      label={label}
      placeholder={customerId === null ? 'Choisissez d’abord un client' : 'Aucun site sélectionné'}
      {...(customerId === null
        ? {}
        : {
            hint: 'L’adresse et les consignes d’accès du site seront recopiées sur la mission.',
          })}
      disabled={disabled || customerId === null || sites.isPending}
    />
  );
}
