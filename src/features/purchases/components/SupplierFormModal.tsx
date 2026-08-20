import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

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

  const [formData, setFormData] = useState<SupplierInput>({
    name: '',
    code: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    siret: '',
    vatNumber: '',
    website: '',
    defaultPaymentTerms: '30 jours fin de mois',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supplierToEdit) {
      setFormData({
        name: supplierToEdit.name,
        code: supplierToEdit.code ?? '',
        contactName: supplierToEdit.contactName ?? '',
        email: supplierToEdit.email ?? '',
        phone: supplierToEdit.phone ?? '',
        address: supplierToEdit.address ?? '',
        city: supplierToEdit.city ?? '',
        postalCode: supplierToEdit.postalCode ?? '',
        siret: supplierToEdit.siret ?? '',
        vatNumber: supplierToEdit.vatNumber ?? '',
        website: supplierToEdit.website ?? '',
        defaultPaymentTerms: supplierToEdit.defaultPaymentTerms ?? '30 jours fin de mois',
        notes: supplierToEdit.notes ?? '',
      });
    } else {
      setFormData({
        name: '',
        code: '',
        contactName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        postalCode: '',
        siret: '',
        vatNumber: '',
        website: '',
        defaultPaymentTerms: '30 jours fin de mois',
        notes: '',
      });
    }
    setError(null);
  }, [supplierToEdit, isOpen]);

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
      description="Enregistrez les coordonnées de votre fournisseur ou grossiste partenaire."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="rounded-xl border border-error-border bg-error-subtle p-3 text-xs text-error">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Nom du fournisseur */}
          <div>
            <label htmlFor="supplierformmodal-raison-sociale-nom" className="block text-xs font-semibold text-foreground mb-1">
              Raison sociale / Nom *
            </label>
            <Input id="supplierformmodal-raison-sociale-nom"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Rexel, Sonepar, Foliatec..."
              required
            />
          </div>

          {/* Code fournisseur */}
          <div>
            <label htmlFor="supplierformmodal-code-fournisseur-interne" className="block text-xs font-semibold text-foreground mb-1">
              Code Fournisseur (Interne)
            </label>
            <Input id="supplierformmodal-code-fournisseur-interne"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="Ex: SUP-REXEL"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Contact */}
          <div>
            <label htmlFor="supplierformmodal-interlocuteur-commercial" className="block text-xs font-semibold text-foreground mb-1">
              Interlocuteur / Commercial
            </label>
            <Input id="supplierformmodal-interlocuteur-commercial"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              placeholder="Ex: Marc Delorme"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="supplierformmodal-email-commandes" className="block text-xs font-semibold text-foreground mb-1">
              Email commandes
            </label>
            <Input id="supplierformmodal-email-commandes"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="commandes@fournisseur.fr"
            />
          </div>

          {/* Téléphone */}
          <div>
            <label htmlFor="supplierformmodal-telephone" className="block text-xs font-semibold text-foreground mb-1">
              Téléphone
            </label>
            <Input id="supplierformmodal-telephone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="01 23 45 67 89"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Adresse */}
          <div className="sm:col-span-2">
            <label htmlFor="supplierformmodal-adresse" className="block text-xs font-semibold text-foreground mb-1">
              Adresse
            </label>
            <Input id="supplierformmodal-adresse"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="12 Avenue des Métiers"
            />
          </div>

          {/* Ville / CP */}
          <div>
            <label htmlFor="supplierformmodal-code-postal-amp-ville" className="block text-xs font-semibold text-foreground mb-1">
              Code Postal &amp; Ville
            </label>
            <Input id="supplierformmodal-code-postal-amp-ville"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="75009 Paris"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Modalités de paiement */}
          <div>
            <label htmlFor="supplierformmodal-conditions-de-reglement" className="block text-xs font-semibold text-foreground mb-1">
              Conditions de règlement
            </label>
            <Input id="supplierformmodal-conditions-de-reglement"
              value={formData.defaultPaymentTerms}
              onChange={(e) =>
                setFormData({ ...formData, defaultPaymentTerms: e.target.value })
              }
              placeholder="Ex: 30 jours fin de mois, Virement 45j..."
            />
          </div>

          {/* Site Web */}
          <div>
            <label htmlFor="supplierformmodal-site-internet-e-shop" className="block text-xs font-semibold text-foreground mb-1">
              Site Internet / E-Shop
            </label>
            <Input id="supplierformmodal-site-internet-e-shop"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="supplierformmodal-notes-amp-tarifs-negocies" className="block text-xs font-semibold text-foreground mb-1">
            Notes &amp; Tarifs négociés
          </label>
          <textarea id="supplierformmodal-notes-amp-tarifs-negocies"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Numéro de compte client, franco de port, remise négociée..."
            rows={2}
            className="w-full rounded-xl border border-border bg-surface p-2.5 text-xs text-foreground placeholder:text-subtle-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting
              ? 'Enregistrement…'
              : isEditing
                ? 'Mettre à jour le fournisseur'
                : 'Ajouter le fournisseur'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
