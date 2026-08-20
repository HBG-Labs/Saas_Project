import {
  Edit2,
  Globe,
  Mail,
  Phone,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

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

  return (
    <Card className="border-border bg-surface shadow-xs">
      {/* Barre de recherche */}
      <div className="p-3 sm:p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par raison sociale, contact, ville, téléphone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 rounded-xl border border-border bg-surface-raised pl-9 pr-4 text-xs text-foreground placeholder:text-subtle-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Tableau compact sans slider horizontal */}
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface-raised/50 text-muted-foreground text-3xs font-bold uppercase tracking-wider">
            <th className="py-2.5 px-3 sm:px-4">Fournisseur &amp; Réf.</th>
            <th className="py-2.5 px-3">Contact &amp; Coordonnées</th>
            <th className="py-2.5 px-3 hidden md:table-cell">Localisation &amp; Activité</th>
            <th className="py-2.5 px-3 sm:px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filteredSuppliers.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-10 text-center text-muted-foreground">
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
                <tr
                  key={sup.id}
                  className="hover:bg-surface-hover/50 transition-colors group"
                >
                  {/* 1. Fournisseur & Code */}
                  <td className="py-3 px-3 sm:px-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="font-bold text-foreground text-xs leading-snug">
                        {sup.name}
                      </p>
                      {sup.code && (
                        <span className="font-mono text-3xs font-bold text-muted-foreground bg-surface-raised px-1.5 py-0.2 rounded border border-border">
                          {sup.code}
                        </span>
                      )}
                    </div>
                    {sup.notes && (
                      <p className="text-3xs text-subtle-foreground line-clamp-1">
                        {sup.notes}
                      </p>
                    )}
                    {sup.website && (
                      <a
                        href={sup.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-3xs text-primary hover:underline mt-0.5"
                      >
                        <Globe className="size-2.5" />
                        <span>Site web</span>
                      </a>
                    )}
                  </td>

                  {/* 2. Contact & Coordonnées */}
                  <td className="py-3 px-3">
                    {sup.contactName && (
                      <p className="font-semibold text-foreground text-xs">
                        {sup.contactName}
                      </p>
                    )}
                    <div className="flex flex-col gap-0.5 text-3xs text-subtle-foreground mt-0.5">
                      {sup.email && (
                        <a
                          href={`mailto:${sup.email}`}
                          className="hover:text-primary transition-colors flex items-center gap-1 truncate max-w-xs"
                        >
                          <Mail className="size-2.5" />
                          <span>{sup.email}</span>
                        </a>
                      )}
                      {sup.phone && (
                        <a
                          href={`tel:${sup.phone}`}
                          className="hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <Phone className="size-2.5" />
                          <span>{sup.phone}</span>
                        </a>
                      )}
                    </div>
                  </td>

                  {/* 3. Localisation & Activité */}
                  <td className="py-3 px-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      {sup.city && (
                        <p className="text-xs text-foreground font-medium">
                          📍 {sup.city} {sup.postalCode ? `(${sup.postalCode})` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-3xs text-subtle-foreground">
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
                  <td className="py-3 px-3 sm:px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCreateOrder(sup)}
                        title="Créer un bon de commande auprès de ce fournisseur"
                        className="h-7 px-2 text-2xs gap-1 text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                      >
                        <ShoppingCart className="size-3" />
                        <span className="hidden sm:inline">Commander</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(sup)}
                        title="Modifier la fiche fournisseur"
                        className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const warningMsg =
                            stat.count > 0
                              ? `Ce fournisseur possède ${stat.count} commande(s) enregistrée(s).\nÊtes-vous sûr de vouloir supprimer le fournisseur « ${sup.name} » ?`
                              : `Êtes-vous sûr de vouloir supprimer le fournisseur « ${sup.name} » ?`;

                          if (confirm(warningMsg)) {
                            onDelete(sup.id);
                          }
                        }}
                        title="Supprimer le fournisseur"
                        className="size-7 p-0 text-muted-foreground hover:text-error cursor-pointer"
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
    </Card>
  );
}
