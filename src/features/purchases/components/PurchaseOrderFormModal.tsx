import { SelectField } from '@/components/ui/SelectField';
import { Package, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { StockConsumable } from '@/features/stock';

import type {
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderItemInput,
  Supplier,
} from '../types/purchases.types';

const COMMON_UNITS = [
  { value: 'pièce', label: 'Pièce (u)' },
  { value: 'm', label: 'Mètre (m)' },
  { value: 'boîte', label: 'Boîte' },
  { value: 'rouleau', label: 'Rouleau' },
  { value: 'kit', label: 'Kit' },
  { value: 'kg', label: 'Kilogramme (kg)' },
  { value: 'litre', label: 'Litre (L)' },
  { value: 'bobine', label: 'Bobine' },
  { value: 'paquet', label: 'Paquet' },
];

interface PurchaseOrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: PurchaseOrderInput) => Promise<unknown> | void;
  orderToEdit?: PurchaseOrder | null | undefined;
  suppliers: Supplier[];
  consumables?: StockConsumable[] | undefined;
  initialSupplierId?: string | undefined;
  initialItems?: PurchaseOrderItemInput[] | undefined;
}

export function PurchaseOrderFormModal({
  isOpen,
  onClose,
  onSubmit,
  orderToEdit,
  suppliers,
  consumables = [],
  initialSupplierId,
  initialItems,
}: PurchaseOrderFormModalProps) {
  const isEditing = Boolean(orderToEdit);

  /*
    L'état part des props, sans effet de resynchronisation : la page ne monte
    cette modale que lorsqu'elle est ouverte, donc React la remonte à chaque
    ouverture. La version précédente recopiait les props dans l'état par un
    `useEffect` — un `setState` dans un effet, donc un rendu en cascade.

    La référence reste VIDE à la création : le serveur la numérote au format
    `CMD-AAAA-NNN`. La version précédente tirait ici un nombre AU HASARD entre
    100 et 999, ce qui finissait par produire deux commandes homonymes.
  */
  const [supplierId, setSupplierId] = useState<string>(
    orderToEdit?.supplierId ?? initialSupplierId ?? suppliers[0]?.id ?? '',
  );
  const [reference, setReference] = useState<string>(orderToEdit?.reference ?? '');
  const [orderDate, setOrderDate] = useState<string>(
    orderToEdit?.orderDate ?? new Date().toISOString().slice(0, 10),
  );
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>(
    orderToEdit?.expectedDeliveryDate ?? '',
  );
  const [missionRef, setMissionRef] = useState<string>(orderToEdit?.missionRef ?? '');
  const [taxRate, setTaxRate] = useState<number>(orderToEdit?.taxRate ?? 0.2);
  const [notes, setNotes] = useState<string>(orderToEdit?.notes ?? '');
  const [status, setStatus] = useState<'draft' | 'sent'>(
    orderToEdit?.status === 'sent' ? 'sent' : 'draft',
  );

  const [items, setItems] = useState<PurchaseOrderItemInput[]>(() => {
    if (orderToEdit) {
      return orderToEdit.items.map((i) => ({
        id: i.id,
        consumableId: i.consumableId,
        reference: i.reference,
        description: i.description,
        unit: i.unit || 'pièce',
        quantityOrdered: i.quantityOrdered,
        quantityReceived: i.quantityReceived,
        unitPriceEur: i.unitPriceEur,
      }));
    }

    if (initialItems && initialItems.length > 0) return initialItems;

    return [
      {
        reference: '',
        description: '',
        unit: 'pièce',
        quantityOrdered: 1,
        unitPriceEur: 0,
      },
    ];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        reference: '',
        description: '',
        unit: 'pièce',
        quantityOrdered: 1,
        unitPriceEur: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof PurchaseOrderItemInput, value: unknown) => {
    setItems((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (!target) return prev;

      updated[index] = {
        ...target,
        [field]: value,
      };
      return updated;
    });
  };

  const handleSelectConsumable = (index: number, consumableId: string) => {
    const consumable = consumables.find((c) => c.id === consumableId);
    if (!consumable) return;

    setItems((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (!target) return prev;

      updated[index] = {
        ...target,
        consumableId: consumable.id,
        reference: consumable.reference,
        description: consumable.name,
        unit: consumable.unit || 'pièce',
        unitPriceEur: consumable.unitPriceEur ?? target.unitPriceEur ?? 0,
      };
      return updated;
    });
  };

  // Calculs totaux avec arrondi au centime
  const subtotalEur =
    Math.round(
      items.reduce(
        (sum, item) => sum + (Number(item.quantityOrdered) || 0) * (Number(item.unitPriceEur) || 0),
        0,
      ) * 100,
    ) / 100;
  const taxEur = Math.round(subtotalEur * taxRate * 100) / 100;
  const totalEur = Math.round((subtotalEur + taxEur) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setError('Veuillez sélectionner un fournisseur.');
      return;
    }

    const validItems = items.filter(
      (i) => i.reference.trim() !== '' || i.description.trim() !== '',
    );

    if (validItems.length === 0) {
      setError('Veuillez ajouter au moins une ligne d’article avec une référence ou désignation.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        supplierId,
        reference: reference.trim() || undefined,
        orderDate,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        missionRef: missionRef.trim() || undefined,
        taxRate,
        notes: notes.trim() || undefined,
        status,
        items: validItems,
      });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors de l’enregistrement de la commande.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="xl"
      title={isEditing ? 'Modifier la commande fournisseur' : 'Nouveau bon de commande'}
      description="Émettez un bon de commande fournisseur (PO) pour réapprovisionner le stock ou commander pour un chantier."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="purchase-order-form"
            variant="primary"
            isLoading={isSubmitting}
            loadingLabel="Enregistrement…"
          >
            {isEditing ? 'Mettre à jour la commande' : 'Créer le bon de commande'}
          </Button>
        </>
      }
    >
      <form id="purchase-order-form" onSubmit={handleSubmit} className="space-y-6">
        <FormError error={error} />

        {/* 1. Informations Générales de la Commande */}
        <div className="border-border bg-surface-raised/40 space-y-4 rounded-2xl border p-4 sm:p-5">
          <h4 className="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
            <span className="bg-primary size-2 rounded-full" />
            <span>Informations générales</span>
          </h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="purchaseorderformmodal-fournisseur-partenaire"
              label="Fournisseur partenaire"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
            >
              <option value="">Sélectionner un fournisseur</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ''}
                </option>
              ))}
            </SelectField>

            <Input
              id="purchaseorderformmodal-n-reference-bon-de-commande"
              label="N° de référence du bon de commande"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Attribuée automatiquement"
              className="font-mono font-bold"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-3">
            <Input
              id="purchaseorderformmodal-date-d-emission"
              label="Date d’émission"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              required
            />

            <Input
              id="purchaseorderformmodal-livraison-estimee"
              label="Livraison estimée"
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            />

            <Input
              id="purchaseorderformmodal-ref-chantier-optionnel"
              label="Réf. chantier (optionnel)"
              value={missionRef}
              onChange={(e) => setMissionRef(e.target.value)}
              placeholder="Ex: INT-2026-081"
            />
          </div>
        </div>

        {/* 2. Articles & Lignes de Commande */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
              <Package className="text-primary size-4" />
              <span>Articles &amp; matériel commandé ({items.length})</span>
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="border-primary/30 text-primary hover:bg-primary/10 h-8 cursor-pointer gap-1.5 px-3 text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              <span>Ajouter une ligne</span>
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => {
              const lineTotal =
                Math.round(
                  (Number(item.quantityOrdered) || 0) * (Number(item.unitPriceEur) || 0) * 100,
                ) / 100;

              return (
                <div
                  key={index}
                  className="border-border bg-surface hover:border-primary/40 relative space-y-4 rounded-2xl border p-4 shadow-sm transition-all sm:p-5"
                >
                  {/* Barre supérieure de la ligne : Numéro, Sélecteur Stock & Supprimer */}
                  <div className="border-border/60 flex flex-col justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2.5">
                      <span className="bg-primary/15 text-primary flex size-6 items-center justify-center rounded-lg font-mono text-xs font-bold">
                        #{index + 1}
                      </span>
                      <span className="text-foreground text-xs font-bold">
                        {item.description || item.reference || `Article ${index + 1}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {consumables.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-3xs text-muted-foreground flex items-center gap-1 font-semibold">
                            <Sparkles className="text-warning size-3" />
                            Catalogue Stock :
                          </span>
                          <SelectField
                            label={`Importer un article du stock pour la ligne ${index + 1}`}
                            hideLabel
                            onChange={(e) => {
                              if (e.target.value) handleSelectConsumable(index, e.target.value);
                            }}
                            defaultValue=""
                            className="border-border bg-surface-raised text-2xs text-foreground focus:border-primary h-7 max-w-xs truncate rounded-lg border px-2 focus:outline-none"
                          >
                            <option value="">-- Importer depuis le stock --</option>
                            {consumables.map((c) => (
                              <option key={c.id} value={c.id}>
                                [{c.reference}] {c.name} ({c.unitPriceEur?.toFixed(2) ?? '0.00'} €)
                              </option>
                            ))}
                          </SelectField>
                        </div>
                      )}

                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                          className="text-2xs text-muted-foreground hover:text-error hover:bg-error/10 h-7 cursor-pointer gap-1 px-2"
                          title="Supprimer cette ligne"
                        >
                          <Trash2 className="size-3.5" />
                          <span className="hidden sm:inline">Supprimer</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Ligne 1 : Désignation complète de l'article */}
                  <div>
                    <Input
                      id={`purchase-order-description-${index}`}
                      label="Désignation / nom complet de l’article"
                      placeholder="Ex: Câble Fibre Optique 4 FO G.657.A2 (500m)"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      required
                      className="font-medium"
                    />
                  </div>

                  {/* Ligne 2 : Grille bien aérée Référence / Unité / Quantité / Prix HT */}
                  <div className="grid grid-cols-1 items-end gap-3.5 sm:grid-cols-12">
                    {/* Référence SKU */}
                    <div className="sm:col-span-4">
                      <Input
                        id={`purchase-order-reference-${index}`}
                        label="Référence SKU / code"
                        placeholder="Ex: FBR-CAB-4FO"
                        value={item.reference}
                        onChange={(e) => handleItemChange(index, 'reference', e.target.value)}
                        required
                        className="font-mono font-bold"
                      />
                    </div>

                    {/* Unité */}
                    <div className="sm:col-span-3">
                      <SelectField
                        id={`purchase-order-unit-${index}`}
                        label="Unité de mesure"
                        value={item.unit || 'pièce'}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                      >
                        {COMMON_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </SelectField>
                    </div>

                    {/* Quantité commandée */}
                    <div className="sm:col-span-2">
                      <Input
                        id={`purchase-order-quantity-${index}`}
                        label="Quantité"
                        type="number"
                        min={0.01}
                        step="any"
                        placeholder="1"
                        value={item.quantityOrdered}
                        onChange={(e) =>
                          handleItemChange(index, 'quantityOrdered', Number(e.target.value))
                        }
                        required
                        className="border-primary/40 text-right font-mono font-bold"
                      />
                    </div>

                    {/* Prix Unitaire HT */}
                    <div className="sm:col-span-3">
                      <Input
                        id={`purchase-order-unit-price-${index}`}
                        label="Prix unitaire HT (€)"
                        type="number"
                        min={0}
                        step="any"
                        placeholder="0.00"
                        value={item.unitPriceEur}
                        onChange={(e) =>
                          handleItemChange(index, 'unitPriceEur', Number(e.target.value))
                        }
                        required
                        trailingSlot={
                          <span className="text-muted-foreground text-xs font-bold">€</span>
                        }
                        className="text-right font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Ligne 3 : Bannière récapitulative du calcul de la ligne */}
                  <div className="bg-surface-raised/70 border-border/50 flex items-center justify-between rounded-xl border px-3.5 py-2 text-xs">
                    <div className="text-muted-foreground flex items-center gap-2">
                      <span className="text-3xs font-medium tracking-wider uppercase">
                        Sous-total ligne :
                      </span>
                      <span className="text-foreground font-mono font-bold">
                        {item.quantityOrdered} {item.unit || 'pièce'}
                      </span>
                      <span>×</span>
                      <span className="text-foreground font-mono font-bold">
                        {Number(item.unitPriceEur || 0).toFixed(2)} € HT
                      </span>
                    </div>

                    <div className="text-primary font-mono text-sm font-extrabold">
                      {lineTotal.toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                      })}{' '}
                      <span className="text-3xs text-muted-foreground font-normal">HT</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Récapitulatif Financier Global */}
        <div className="border-border bg-surface-raised/80 space-y-3 rounded-2xl border p-5 shadow-sm">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span className="text-3xs font-semibold tracking-wider uppercase">
              Sous-total Hors Taxes (HT) :
            </span>
            <span className="text-foreground font-mono text-base font-bold">
              {subtotalEur.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
              })}
            </span>
          </div>

          <div className="text-muted-foreground border-border/50 flex flex-col justify-between gap-2 border-t pt-2.5 text-xs sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <span className="text-3xs font-semibold tracking-wider uppercase">
                Taux de TVA appliqué :
              </span>
              <SelectField
                label="Taux de TVA appliqué"
                hideLabel
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="border-border bg-surface text-foreground focus:border-primary h-8 rounded-lg border px-2.5 text-xs font-medium focus:outline-none"
              >
                <option value={0.2}>20 % (TVA Standard France)</option>
                <option value={0.1}>10 % (TVA Intermédiaire)</option>
                <option value={0.055}>5.5 % (TVA Réduite)</option>
                <option value={0}>0 % (Exonéré / Autoliquidation)</option>
              </SelectField>
            </div>
            <span className="text-foreground font-mono font-bold">
              {taxEur.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
              })}{' '}
              <span className="text-3xs text-muted-foreground font-normal">TVA</span>
            </span>
          </div>

          <div className="text-foreground border-border flex items-center justify-between border-t pt-3 text-base font-bold">
            <span className="text-xs tracking-wider uppercase">Total TTC à payer :</span>
            <span className="text-primary font-mono text-xl font-extrabold">
              {totalEur.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
              })}
            </span>
          </div>
        </div>

        {/* 4. Statut & Remarques */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            id="purchaseorderformmodal-statut-initial-de-la-commande"
            label="Statut initial de la commande"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'draft' | 'sent')}
          >
            <option value="draft">Brouillon (À valider avant envoi)</option>
            <option value="sent">Envoyée / En attente de livraison</option>
          </SelectField>

          <Input
            id="purchaseorderformmodal-instructions-de-livraison-remarques"
            label="Instructions de livraison / remarques"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Livrer au quai B avant 12h"
          />
        </div>
      </form>
    </Modal>
  );
}
