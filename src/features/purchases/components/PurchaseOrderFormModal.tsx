import { SelectField } from '@/components/ui/SelectField';
import { Package, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';

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

  const handleItemChange = (
    index: number,
    field: keyof PurchaseOrderItemInput,
    value: unknown,
  ) => {
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
  const subtotalEur = Math.round(
    items.reduce(
      (sum, item) =>
        sum + (Number(item.quantityOrdered) || 0) * (Number(item.unitPriceEur) || 0),
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
      title={isEditing ? 'Modifier la commande fournisseur' : 'Nouveau Bon de Commande'}
      description="Émettez un bon de commande fournisseur (PO) pour réapprovisionner le stock ou commander pour un chantier."
    >
      <form onSubmit={handleSubmit} className="space-y-6 pt-2 max-h-[80vh] overflow-y-auto pr-1">
        {error && (
          <div className="rounded-xl border border-error-border bg-error-subtle p-3.5 text-xs text-error font-medium">
            {error}
          </div>
        )}

        {/* 1. Informations Générales de la Commande */}
        <div className="rounded-2xl border border-border bg-surface-raised/40 p-4 sm:p-5 space-y-4">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" />
            <span>Informations Générales</span>
          </h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="purchaseorderformmodal-fournisseur-partenaire" className="block text-xs font-semibold text-foreground mb-1.5">
                Fournisseur Partenaire *
              </label>
              <SelectField id="purchaseorderformmodal-fournisseur-partenaire"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
                className="w-full h-10 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="">-- Sélectionner un fournisseur --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ''}
                  </option>
                ))}
              </SelectField>
            </div>

            <div>
              <label htmlFor="purchaseorderformmodal-n-reference-bon-de-commande" className="block text-xs font-semibold text-foreground mb-1.5">
                N° Référence Bon de Commande *
              </label>
              <Input id="purchaseorderformmodal-n-reference-bon-de-commande"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Attribuée automatiquement"
                className="h-10 font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-1">
            <div>
              <label htmlFor="purchaseorderformmodal-date-d-emission" className="block text-xs font-semibold text-foreground mb-1.5">
                Date d'émission *
              </label>
              <Input id="purchaseorderformmodal-date-d-emission"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                required
                className="h-10"
              />
            </div>

            <div>
              <label htmlFor="purchaseorderformmodal-livraison-estimee" className="block text-xs font-semibold text-foreground mb-1.5">
                Livraison estimée
              </label>
              <Input id="purchaseorderformmodal-livraison-estimee"
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="h-10"
              />
            </div>

            <div>
              <label htmlFor="purchaseorderformmodal-ref-chantier-optionnel" className="block text-xs font-semibold text-foreground mb-1.5">
                Réf. Chantier (Optionnel)
              </label>
              <Input id="purchaseorderformmodal-ref-chantier-optionnel"
                value={missionRef}
                onChange={(e) => setMissionRef(e.target.value)}
                placeholder="Ex: INT-2026-081"
                className="h-10"
              />
            </div>
          </div>
        </div>

        {/* 2. Articles & Lignes de Commande */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Package className="size-4 text-primary" />
              <span>Articles &amp; Matériel commandé ({items.length})</span>
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="gap-1.5 text-xs h-8 px-3 font-semibold cursor-pointer border-primary/30 text-primary hover:bg-primary/10"
            >
              <Plus className="size-3.5" />
              <span>Ajouter une ligne</span>
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => {
              const lineTotal =
                Math.round(
                  (Number(item.quantityOrdered) || 0) *
                    (Number(item.unitPriceEur) || 0) *
                    100,
                ) / 100;

              return (
                <div
                  key={index}
                  className="rounded-2xl border border-border bg-surface p-4 sm:p-5 space-y-4 shadow-sm relative transition-all hover:border-primary/40"
                >
                  {/* Barre supérieure de la ligne : Numéro, Sélecteur Stock & Supprimer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-6 items-center justify-center rounded-lg bg-primary/15 text-primary text-xs font-bold font-mono">
                        #{index + 1}
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        {item.description || item.reference || `Article ${index + 1}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {consumables.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-3xs text-muted-foreground font-semibold flex items-center gap-1">
                            <Sparkles className="size-3 text-warning" />
                            Catalogue Stock :
                          </span>
                          <SelectField
                            onChange={(e) => {
                              if (e.target.value) handleSelectConsumable(index, e.target.value);
                            }}
                            defaultValue=""
                            className="h-7 rounded-lg border border-border bg-surface-raised px-2 text-2xs text-foreground focus:border-primary focus:outline-none max-w-xs truncate"
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
                          className="h-7 px-2 text-2xs text-muted-foreground hover:text-error hover:bg-error/10 cursor-pointer gap-1"
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
                    <label htmlFor="purchaseorderformmodal-designation-nom-complet-de-l-article" className="block text-3xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Désignation / Nom complet de l'article *
                    </label>
                    <Input id="purchaseorderformmodal-designation-nom-complet-de-l-article"
                      placeholder="Ex: Câble Fibre Optique 4 FO G.657.A2 (500m)"
                      value={item.description}
                      onChange={(e) =>
                        handleItemChange(index, 'description', e.target.value)
                      }
                      required
                      className="h-10 text-xs font-medium"
                    />
                  </div>

                  {/* Ligne 2 : Grille bien aérée Référence / Unité / Quantité / Prix HT */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                    {/* Référence SKU */}
                    <div className="sm:col-span-4">
                      <label htmlFor="purchaseorderformmodal-reference-sku-code" className="block text-3xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        Référence SKU / Code *
                      </label>
                      <Input id="purchaseorderformmodal-reference-sku-code"
                        placeholder="Ex: FBR-CAB-4FO"
                        value={item.reference}
                        onChange={(e) =>
                          handleItemChange(index, 'reference', e.target.value)
                        }
                        required
                        className="h-10 font-mono text-xs font-bold"
                      />
                    </div>

                    {/* Unité */}
                    <div className="sm:col-span-3">
                      <label htmlFor="purchaseorderformmodal-unite-de-mesure" className="block text-3xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        Unité de mesure
                      </label>
                      <SelectField id="purchaseorderformmodal-unite-de-mesure"
                        value={item.unit || 'pièce'}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        className="w-full h-10 rounded-xl border border-border bg-surface px-2.5 text-xs text-foreground focus:border-primary focus:outline-none font-medium"
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
                      <label htmlFor="purchaseorderformmodal-quantite" className="block text-3xs font-bold text-primary uppercase tracking-wider mb-1">
                        Quantité *
                      </label>
                      <Input id="purchaseorderformmodal-quantite"
                        type="number"
                        min={0.01}
                        step="any"
                        placeholder="1"
                        value={item.quantityOrdered}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            'quantityOrdered',
                            Number(e.target.value),
                          )
                        }
                        required
                        className="h-10 text-right font-mono font-bold text-sm border-primary/40 focus:border-primary"
                      />
                    </div>

                    {/* Prix Unitaire HT */}
                    <div className="sm:col-span-3">
                      <label htmlFor="purchaseorderformmodal-prix-unit-ht" className="block text-3xs font-bold text-success uppercase tracking-wider mb-1">
                        Prix Unit. HT (€) *
                      </label>
                      <div className="relative">
                        <Input id="purchaseorderformmodal-prix-unit-ht"
                          type="number"
                          min={0}
                          step="any"
                          placeholder="0.00"
                          value={item.unitPriceEur}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              'unitPriceEur',
                              Number(e.target.value),
                            )
                          }
                          required
                          className="h-10 text-right font-mono font-bold text-sm pr-7"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                          €
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ligne 3 : Bannière récapitulative du calcul de la ligne */}
                  <div className="flex items-center justify-between rounded-xl bg-surface-raised/70 px-3.5 py-2 text-xs border border-border/50">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium text-3xs uppercase tracking-wider">
                        Sous-total ligne :
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {item.quantityOrdered} {item.unit || 'pièce'}
                      </span>
                      <span>×</span>
                      <span className="font-mono font-bold text-foreground">
                        {Number(item.unitPriceEur || 0).toFixed(2)} € HT
                      </span>
                    </div>

                    <div className="font-mono font-extrabold text-primary text-sm">
                      {lineTotal.toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                      })}{' '}
                      <span className="text-3xs font-normal text-muted-foreground">HT</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Récapitulatif Financier Global */}
        <div className="rounded-2xl border border-border bg-surface-raised/80 p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-3xs">
              Sous-total Hors Taxes (HT) :
            </span>
            <span className="font-bold text-foreground font-mono text-base">
              {subtotalEur.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
              })}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground border-t border-border/50 pt-2.5">
            <div className="flex items-center gap-2.5">
              <span className="font-semibold uppercase tracking-wider text-3xs">
                Taux de TVA appliqué :
              </span>
              <SelectField
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs text-foreground focus:border-primary focus:outline-none font-medium"
              >
                <option value={0.2}>20 % (TVA Standard France)</option>
                <option value={0.1}>10 % (TVA Intermédiaire)</option>
                <option value={0.055}>5.5 % (TVA Réduite)</option>
                <option value={0}>0 % (Exonéré / Autoliquidation)</option>
              </SelectField>
            </div>
            <span className="font-mono font-bold text-foreground">
              {taxEur.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
              })}{' '}
              <span className="text-3xs font-normal text-muted-foreground">TVA</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-base font-bold text-foreground pt-3 border-t border-border">
            <span className="uppercase tracking-wider text-xs">Total TTC à payer :</span>
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
          <div>
            <label htmlFor="purchaseorderformmodal-statut-initial-de-la-commande" className="block text-xs font-semibold text-foreground mb-1.5">
              Statut initial de la commande
            </label>
            <SelectField id="purchaseorderformmodal-statut-initial-de-la-commande"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'sent')}
              className="w-full h-10 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none font-medium"
            >
              <option value="draft">Brouillon (À valider avant envoi)</option>
              <option value="sent">Envoyée / En attente de livraison</option>
            </SelectField>
          </div>

          <div>
            <label htmlFor="purchaseorderformmodal-instructions-de-livraison-remarques" className="block text-xs font-semibold text-foreground mb-1.5">
              Instructions de livraison / Remarques
            </label>
            <Input id="purchaseorderformmodal-instructions-de-livraison-remarques"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Livrer au quai B avant 12h"
              className="h-10"
            />
          </div>
        </div>

        {/* 5. Boutons d'action */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 px-4 text-xs font-semibold"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="h-10 px-5 text-xs font-bold cursor-pointer"
          >
            {isSubmitting
              ? 'Enregistrement…'
              : isEditing
                ? 'Mettre à jour la commande'
                : 'Créer le bon de commande'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
