import { useEffect, useMemo } from 'react';

import { Select } from '@/components/ui/Select';

import { useCustomerSites } from '../hooks/useCustomerChildren';
import { useCustomers } from '../hooks/useCustomers';

/**
 * Sélecteurs client et site, destinés au formulaire de mission (Phase 6).
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

  // Mémoïsé : sans cela, un nouveau tableau à chaque rendu relancerait l'effet
  // de pré-sélection en boucle.
  const availableSites = useMemo(() => sites.data ?? [], [sites.data]);

  // Pré-sélection automatique du premier site dès le choix du client
  useEffect(() => {
    if (customerId && availableSites.length > 0 && (!value || !availableSites.some(s => s.id === value))) {
      const first = availableSites[0];
      if (first) onChange(first.id);
    }
  }, [customerId, availableSites, value, onChange]);

  const options = availableSites.map((site) => ({
    value: site.id,
    label: site.city !== null && site.city !== '' ? `${site.name} — ${site.city}` : site.name,
  }));

  return (
    <Select
      options={options}
      {...(value !== null ? { value } : {})}
      onValueChange={onChange}
      label={label}
      placeholder={customerId === null ? 'Choisissez d’abord un client' : 'Sélectionnez un site'}
      {...(customerId === null
        ? {}
        : {
            hint: 'L’adresse et les consignes d’accès du site seront recopiées sur la mission.',
          })}
      disabled={disabled || customerId === null || sites.isPending}
    />
  );
}
