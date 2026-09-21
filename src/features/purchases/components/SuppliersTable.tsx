import {
  Building2,
  Edit2,
  Globe,
  Mail,
  MapPin,
  Phone,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

import type { PurchaseOrder, Supplier } from '../types/purchases.types';

interface SuppliersTableProps {
  suppliers: Supplier[];
  orders?: PurchaseOrder[];
  onEdit: (supplier: Supplier) => void;
  onDelete: (id: string) => void;
  onCreateOrder: (supplier: Supplier) => void;
}

export function SuppliersTable({
  suppliers,
  orders = [],
  onEdit,
  onDelete,
  onCreateOrder,
}: SuppliersTableProps) {
  const [search, setSearch] = useState('');
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((sup) => {
      const q = search.trim().toLowerCase();
      return (
        q === '' ||
        sup.name.toLowerCase().includes(q) ||
        (sup.code && sup.code.toLowerCase().includes(q)) ||
        (sup.contactName && sup.contactName.toLowerCase().includes(q)) ||
        (sup.city && sup.city.toLowerCase().includes(q)) ||
        (sup.email && sup.email.toLowerCase().includes(q)) ||
        (sup.phone && sup.phone.includes(q))
      );
    });
  }, [suppliers, search]);

  const supplierStats = useMemo(() => {
    const stats: Record<string, { count: number; totalSpent: number }> = {};
    orders.forEach((o) => {
      if (!stats[o.supplierId]) {
        stats[o.supplierId] = { count: 0, totalSpent: 0 };
      }
      const entry = stats[o.supplierId];
      if (entry) {
        entry.count += 1;
        if (o.status !== 'cancelled') {
          entry.totalSpent += o.subtotalEur;
        }
      }
    });
    return stats;
  }, [orders]);

  if (suppliers.length === 0) {
    return (
      <EmptyState
        illustration={<AtelierIllustration subject="customers" />}
        title="Aucun fournisseur"
        description="Ajoutez votre premier partenaire pour préparer des commandes et suivre les achats par fournisseur."
      />
    );
  }

  return (
    <Card className="border-border/80 bg-surface overflow-x-auto shadow-xs">
      {/* Barre de recherche */}
      <div className="border-border border-b p-3 sm:p-4">
        <div>
          <Input
            label="Rechercher un fournisseur"
            hideLabel
            placeholder="Rechercher par raison sociale, contact, ville, téléphone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leadingIcon={<Search aria-hidden="true" />}
            className="bg-surface-raised"
          />
        </div>
        <p className="text-muted-foreground text-3xs mt-2" aria-live="polite">
          {filteredSuppliers.length} fournisseur{filteredSuppliers.length !== 1 ? 's' : ''} affiché
          {filteredSuppliers.length !== 1 ? 's' : ''}
        </p>
      </div>

      {filteredSuppliers.length === 0 ? (
        <div className="text-muted-foreground px-4 py-12 text-center md:hidden">
          <div className="bg-surface-sunken text-muted-foreground mx-auto flex size-11 items-center justify-center rounded-2xl">
            <Building2 className="size-5" aria-hidden="true" />
          </div>
          <p className="text-foreground mt-3 text-sm font-semibold">Aucun fournisseur trouvé</p>
          <p className="text-subtle-foreground mx-auto mt-1 max-w-sm text-xs">
            Ajoutez un partenaire fournisseur ou modifiez votre recherche.
          </p>
        </div>
      ) : (
        <div className="divide-border divide-y md:hidden">
          {filteredSuppliers.map((sup) => {
            const stat = supplierStats[sup.id] || { count: 0, totalSpent: 0 };

            return (
              <article key={sup.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="bg-primary-subtle text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                        <Building2 className="size-4.5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-foreground truncate text-sm font-bold">{sup.name}</h3>
                        <p className="text-muted-foreground text-3xs">
                          {sup.code ? `Réf. ${sup.code}` : 'Fournisseur référencé'}
                        </p>
                      </div>
                    </div>
                  </div>
                  {stat.count > 0 ? (
                    <span className="bg-primary-subtle text-primary text-3xs shrink-0 rounded-full px-2 py-1 font-semibold">
                      {stat.count} commande{stat.count > 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>

                <div className="bg-surface-sunken/45 border-border/70 grid gap-2 rounded-xl border p-3 text-xs">
                  {sup.contactName ? (
                    <p className="text-foreground font-semibold">{sup.contactName}</p>
                  ) : null}
                  <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-2">
                    {sup.phone ? (
                      <a
                        className="hover:text-primary inline-flex items-center gap-1.5"
                        href={`tel:${sup.phone}`}
                      >
                        <Phone className="size-3.5" aria-hidden="true" />
                        {sup.phone}
                      </a>
                    ) : null}
                    {sup.email ? (
                      <a
                        className="hover:text-primary inline-flex min-w-0 items-center gap-1.5"
                        href={`mailto:${sup.email}`}
                      >
                        <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{sup.email}</span>
                      </a>
                    ) : null}
                    {sup.city ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {sup.city} {sup.postalCode ? `(${sup.postalCode})` : ''}
                      </span>
                    ) : null}
                  </div>
                  {stat.count > 0 ? (
                    <p className="text-foreground border-border/60 border-t pt-2 font-medium">
                      {stat.totalSpent.toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                      })}{' '}
                      HT commandés
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCreateOrder(sup)}
                    className="min-h-touch border-primary/30 text-primary flex-1 gap-1.5"
                  >
                    <ShoppingCart className="size-3.5" aria-hidden="true" />
                    Commander
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(sup)}
                    aria-label={`Modifier ${sup.name}`}
                    className="min-h-touch min-w-touch p-0"
                  >
                    <Edit2 className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSupplierToDelete(sup)}
                    aria-label={`Supprimer ${sup.name}`}
                    className="text-muted-foreground hover:text-error min-h-touch min-w-touch p-0"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Tableau desktop */}
      <table className="hidden w-full min-w-[760px] border-collapse text-left text-xs md:table">
        <thead>
          <tr className="border-border bg-surface-raised/50 text-muted-foreground text-3xs border-b font-bold tracking-wider uppercase">
            <th className="px-3 py-2.5 sm:px-4">Fournisseur &amp; Réf.</th>
            <th className="px-3 py-2.5">Contact &amp; Coordonnées</th>
            <th className="hidden px-3 py-2.5 md:table-cell">Localisation &amp; Activité</th>
            <th className="px-3 py-2.5 text-right sm:px-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {filteredSuppliers.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-muted-foreground py-10 text-center">
                <p className="text-sm font-semibold">Aucun fournisseur trouvé</p>
                <p className="text-2xs text-subtle-foreground mt-1">
                  Ajoutez un nouveau partenaire fournisseur ou modifiez votre recherche.
                </p>
              </td>
            </tr>
          ) : (
            filteredSuppliers.map((sup) => {
              const stat = supplierStats[sup.id] || { count: 0, totalSpent: 0 };
              return (
                <tr key={sup.id} className="hover:bg-surface-hover/50 group transition-colors">
                  {/* 1. Fournisseur & Code */}
                  <td className="px-3 py-3 sm:px-4">
                    <div className="mb-1 flex items-center gap-1.5">
                      <p className="text-foreground text-xs leading-snug font-bold">{sup.name}</p>
                      {sup.code && (
                        <span className="text-3xs text-muted-foreground bg-surface-raised py-0.2 border-border rounded border px-1.5 font-mono font-bold">
                          {sup.code}
                        </span>
                      )}
                    </div>
                    {sup.notes && (
                      <p className="text-3xs text-subtle-foreground line-clamp-1">{sup.notes}</p>
                    )}
                    {sup.website && (
                      <a
                        href={sup.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-3xs text-primary mt-0.5 inline-flex items-center gap-1 hover:underline"
                      >
                        <Globe className="size-2.5" />
                        <span>Site web</span>
                      </a>
                    )}
                  </td>

                  {/* 2. Contact & Coordonnées */}
                  <td className="px-3 py-3">
                    {sup.contactName && (
                      <p className="text-foreground text-xs font-semibold">{sup.contactName}</p>
                    )}
                    <div className="text-3xs text-subtle-foreground mt-0.5 flex flex-col gap-0.5">
                      {sup.email && (
                        <a
                          href={`mailto:${sup.email}`}
                          className="hover:text-primary flex max-w-xs items-center gap-1 truncate transition-colors"
                        >
                          <Mail className="size-2.5" />
                          <span>{sup.email}</span>
                        </a>
                      )}
                      {sup.phone && (
                        <a
                          href={`tel:${sup.phone}`}
                          className="hover:text-primary flex items-center gap-1 transition-colors"
                        >
                          <Phone className="size-2.5" />
                          <span>{sup.phone}</span>
                        </a>
                      )}
                    </div>
                  </td>

                  {/* 3. Localisation & Activité */}
                  <td className="hidden px-3 py-3 md:table-cell">
                    <div className="flex items-center gap-2">
                      {sup.city && (
                        <p className="text-foreground inline-flex items-center gap-1 text-xs font-medium">
                          <MapPin className="text-muted-foreground size-3" aria-hidden="true" />
                          {sup.city} {sup.postalCode ? `(${sup.postalCode})` : ''}
                        </p>
                      )}
                    </div>
                    <div className="text-3xs text-subtle-foreground mt-0.5 flex items-center gap-2">
                      {sup.defaultPaymentTerms && (
                        <span>Règlement : {sup.defaultPaymentTerms}</span>
                      )}
                      {stat.count > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-primary font-medium">
                            {stat.count} commande{stat.count > 1 ? 's' : ''} (
                            {stat.totalSpent.toLocaleString('fr-FR', {
                              style: 'currency',
                              currency: 'EUR',
                            })}
                            )
                          </span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* 4. Actions */}
                  <td className="px-3 py-3 text-right sm:px-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCreateOrder(sup)}
                        title="Créer un bon de commande auprès de ce fournisseur"
                        className="text-2xs text-primary border-primary/30 hover:bg-primary/10 h-7 cursor-pointer gap-1 px-2"
                      >
                        <ShoppingCart className="size-3" />
                        <span className="hidden sm:inline">Commander</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(sup)}
                        title="Modifier la fiche fournisseur"
                        aria-label={`Modifier ${sup.name}`}
                        className="text-muted-foreground hover:text-foreground size-7 cursor-pointer p-0"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSupplierToDelete(sup)}
                        title="Supprimer le fournisseur"
                        aria-label={`Supprimer ${sup.name}`}
                        className="text-muted-foreground hover:text-error size-7 cursor-pointer p-0"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <Modal
        open={supplierToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setSupplierToDelete(null);
        }}
        title="Supprimer le fournisseur"
        description={
          supplierToDelete
            ? `« ${supplierToDelete.name} » sera retiré de votre annuaire fournisseurs.`
            : 'Confirmez la suppression de ce fournisseur.'
        }
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setSupplierToDelete(null)}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (supplierToDelete) {
                  onDelete(supplierToDelete.id);
                  setSupplierToDelete(null);
                }
              }}
              className="w-full sm:w-auto"
            >
              Supprimer définitivement
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">Cette action est irréversible.</p>
          {supplierToDelete && (supplierStats[supplierToDelete.id]?.count ?? 0) > 0 ? (
            <p className="border-warning/40 bg-warning-subtle text-foreground rounded-xl border p-3 text-xs">
              Ce fournisseur possède {supplierStats[supplierToDelete.id]?.count ?? 0} commande(s)
              enregistrée(s). Vérifiez leur historique avant de continuer.
            </p>
          ) : null}
        </div>
      </Modal>
    </Card>
  );
}
