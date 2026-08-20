import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  COMMON_CONSUMABLE_CATEGORIES,
  COMMON_UNITS,
  type ConsumableInput,
  type StockConsumable,
} from '../types/stock.types';

interface ConsumableFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: ConsumableInput) => Promise<unknown> | void;
  consumableToEdit?: StockConsumable | null;
}

export function ConsumableFormModal({
  isOpen,
  onClose,
  onSubmit,
  consumableToEdit,
}: ConsumableFormModalProps) {
  const isEditing = Boolean(consumableToEdit);

  const [formData, setFormData] = useState<ConsumableInput>({
    reference: '',
    name: '',
    category: COMMON_CONSUMABLE_CATEGORIES[0] || 'Câblage & Fibre',
    unit: 'pièce',
    quantityInStock: 10,
    minThreshold: 5,
    unitPriceEur: undefined,
    sellingPriceEur: undefined,
    location: 'Dépôt Central',
    supplier: '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (consumableToEdit) {
      setFormData({
        reference: consumableToEdit.reference,
        name: consumableToEdit.name,
        category: consumableToEdit.category,
        unit: consumableToEdit.unit,
        quantityInStock: consumableToEdit.quantityInStock,
        minThreshold: consumableToEdit.minThreshold,
        unitPriceEur: consumableToEdit.unitPriceEur,
        sellingPriceEur: consumableToEdit.sellingPriceEur,
        location: consumableToEdit.location,
        supplier: consumableToEdit.supplier ?? '',
        notes: consumableToEdit.notes ?? '',
      });
    } else {
      setFormData({
        reference: '',
        name: '',
        category: COMMON_CONSUMABLE_CATEGORIES[0] || 'Câblage & Fibre',
        unit: 'pièce',
        quantityInStock: 10,
        minThreshold: 5,
        unitPriceEur: undefined,
        sellingPriceEur: undefined,
        location: 'Dépôt Central',
        supplier: '',
        notes: '',
      });
    }
    setError(null);
  }, [consumableToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.reference.trim()) {
      setError('Veuillez renseigner la référence et le nom de l’article.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        ...formData,
        reference: formData.reference.trim().toUpperCase(),
        name: formData.name.trim(),
        location: formData.location.trim() || 'Dépôt Central',
        supplier: formData.supplier?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de l’enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={isEditing ? 'Modifier l’article de stock' : 'Ajouter un article / fourniture'}
      description="Renseignez les détails du consommable pour suivre les quantités et alertes de réapprovisionnement."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-error-border bg-error-subtle p-3 text-xs text-error">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Référence */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Référence / SKU *
            </label>
            <Input
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="Ex: FBR-PTO-01, DISJ-16A"
              required
            />
          </div>

          {/* Catégorie */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Catégorie *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full h-10 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {COMMON_CONSUMABLE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Nom / Désignation */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Désignation de l’article *
          </label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Câble Fibre Optique 4 FO G.657.A2 (500m)"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Unité */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Unité *
            </label>
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full h-10 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {COMMON_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>

          {/* Quantité initiale / en stock */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Quantité en stock *
            </label>
            <Input
              type="number"
              min={0}
              step={formData.unit === 'm' || formData.unit === 'kg' || formData.unit === 'litre' ? '0.1' : '1'}
              value={formData.quantityInStock}
              onChange={(e) =>
                setFormData({ ...formData, quantityInStock: Math.max(0, Number(e.target.value)) })
              }
              required
            />
          </div>

          {/* Seuil minimum critique */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Seuil d’alerte min. *
            </label>
            <Input
              type="number"
              min={0}
              step={1}
              value={formData.minThreshold}
              onChange={(e) =>
                setFormData({ ...formData, minThreshold: Math.max(0, Number(e.target.value)) })
              }
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Prix d'achat unitaire HT */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Prix d’achat unitaire HT (€)
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={formData.unitPriceEur ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  unitPriceEur: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="Ex: 12.50"
            />
          </div>

          {/* Prix de vente unitaire HT */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Prix de facturation HT (€)
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={formData.sellingPriceEur ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sellingPriceEur: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="Ex: 24.00"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Emplacement */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Emplacement de stockage
            </label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ex: Dépôt Central - Allée B, Véhicule 01..."
            />
          </div>

          {/* Fournisseur */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Fournisseur habituel
            </label>
            <Input
              value={formData.supplier ?? ''}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              placeholder="Ex: Rexel, Sonepar, CEDEO, Wurth..."
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Notes &amp; Remarques
          </label>
          <textarea
            value={formData.notes ?? ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Informations utiles, fiche technique, équivalences..."
            rows={2}
            className="w-full rounded-xl border border-border bg-surface p-2.5 text-xs text-foreground placeholder:text-subtle-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : isEditing ? 'Mettre à jour' : 'Ajouter l’article'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
