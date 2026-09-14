import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';

import type { Supplier, SupplierInput } from '../types/purchases.types';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: SupplierInput) => Promise<unknown> | void;
  supplierToEdit?: Supplier | null | undefined;
}

export function SupplierFormModal({
  isOpen,
  onClose,
  onSubmit,
  supplierToEdit,
}: SupplierFormModalProps) {
  const isEditing = Boolean(supplierToEdit);

  const [formData, setFormData] = useState<SupplierInput>(() => ({
    name: supplierToEdit?.name ?? '',
    code: supplierToEdit?.code ?? '',
    contactName: supplierToEdit?.contactName ?? '',
    email: supplierToEdit?.email ?? '',
    phone: supplierToEdit?.phone ?? '',
    address: supplierToEdit?.address ?? '',
    city: supplierToEdit?.city ?? '',
    postalCode: supplierToEdit?.postalCode ?? '',
    siret: supplierToEdit?.siret ?? '',
    vatNumber: supplierToEdit?.vatNumber ?? '',
    website: supplierToEdit?.website ?? '',
    defaultPaymentTerms: supplierToEdit?.defaultPaymentTerms ?? '30 jours fin de mois',
    notes: supplierToEdit?.notes ?? '',
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    L'état part directement des props : la modale n'est montée que lorsqu'elle
    est ouverte, donc React la remonte à chaque ouverture. La version précédente
    la laissait montée en permanence et recopiait les props dans l'état par un
    `useEffect` — un `setState` dans un effet, donc un rendu en cascade.
  */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Veuillez renseigner le nom de la société fournisseur.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        ...formData,
        name: formData.name.trim(),
        code: formData.code?.trim().toUpperCase() || undefined,
        contactName: formData.contactName?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        city: formData.city?.trim() || undefined,
        postalCode: formData.postalCode?.trim() || undefined,
        siret: formData.siret?.trim() || undefined,
        vatNumber: formData.vatNumber?.trim() || undefined,
        website: formData.website?.trim() || undefined,
        defaultPaymentTerms: formData.defaultPaymentTerms?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors de l’enregistrement du fournisseur.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={isEditing ? 'Modifier la fiche fournisseur' : 'Ajouter un fournisseur'}
      description="Centralisez son identité, ses coordonnées et vos conditions commerciales."
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-touch sm:min-h-0"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            form="supplier-form"
            variant="primary"
            isLoading={isSubmitting}
            loadingLabel="Enregistrement du fournisseur"
            className="min-h-touch sm:min-h-0"
          >
            {isEditing ? 'Mettre à jour le fournisseur' : 'Ajouter le fournisseur'}
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div
            role="alert"
            className="border-error-border bg-error-subtle text-error rounded-xl border p-3 text-xs"
          >
            {error}
          </div>
        )}

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Identité fournisseur</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Informations utilisées dans l’annuaire et les bons de commande.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Raison sociale / Nom"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Rexel, Sonepar, Foliatec…"
              required
            />
            <Input
              label="Code fournisseur interne"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="Ex: SUP-REXEL"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="SIRET"
              inputMode="numeric"
              value={formData.siret}
              onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
              placeholder="14 chiffres"
            />
            <Input
              label="N° TVA intracommunautaire"
              value={formData.vatNumber}
              onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
              placeholder="Ex: FR12345678901"
            />
          </div>
        </section>

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Contact commercial</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Coordonnées utilisées pour vos échanges et vos commandes.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Interlocuteur / Commercial"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              placeholder="Ex: Marc Delorme"
              autoComplete="name"
            />
            <Input
              label="Email commandes"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="commandes@fournisseur.fr"
              autoComplete="email"
            />
            <Input
              label="Téléphone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="01 23 45 67 89"
              autoComplete="tel"
            />
          </div>
        </section>

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Adresse & conditions</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Complétez les informations administratives et commerciales utiles.
            </p>
          </div>
          <Input
            label="Adresse"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="12 Avenue des Métiers"
            autoComplete="street-address"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[0.65fr_1.35fr]">
            <Input
              label="Code postal"
              inputMode="numeric"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              placeholder="75009"
              autoComplete="postal-code"
            />
            <Input
              label="Ville"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Paris"
              autoComplete="address-level2"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Conditions de règlement"
              value={formData.defaultPaymentTerms}
              onChange={(e) => setFormData({ ...formData, defaultPaymentTerms: e.target.value })}
              placeholder="Ex: 30 jours fin de mois"
            />
            <Input
              label="Site Internet / E-Shop"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <Textarea
            label="Notes & tarifs négociés"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Numéro de compte, franco de port, remise négociée…"
            rows={3}
          />
        </section>
      </form>
    </Modal>
  );
}
