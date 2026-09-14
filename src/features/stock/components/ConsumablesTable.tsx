import { SelectField } from '@/components/ui/SelectField';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Edit2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { StockConsumable } from '../types/stock.types';

interface ConsumablesTableProps {
  consumables: StockConsumable[];
  onEdit: (item: StockConsumable) => void;
  onDelete: (id: string) => void;
  onQuickAdjust: (id: string, delta: number) => void;
  onRecordMovement: (item: StockConsumable, defaultType?: 'in' | 'out') => void;
  onOrder?: (item: StockConsumable) => void;
}

export function ConsumablesTable({
  consumables,
  onEdit,
  onDelete,
  onQuickAdjust,
  onRecordMovement,
  onOrder,
}: ConsumablesTableProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'ok'>('all');

  const filteredItems = useMemo(() => {
    return consumables.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        item.name.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        (item.supplier && item.supplier.toLowerCase().includes(q));

      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

      const isLow = item.quantityInStock <= item.minThreshold;
      const matchesStatus =
        stockStatusFilter === 'all' ||
        (stockStatusFilter === 'low' && isLow) ||
        (stockStatusFilter === 'ok' && !isLow);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [consumables, search, categoryFilter, stockStatusFilter]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(consumables.map((c) => c.category));
    return Array.from(cats);
  }, [consumables]);

  return (
    <Card className="border-border bg-surface shadow-xs">
      {/* Barre de recherche et filtres */}
      <div className="border-border space-y-3 border-b p-3 sm:p-4">
        <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
          {/* Champ de recherche */}
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par référence, désignation, emplacement, fournisseur…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-border bg-surface-raised text-foreground placeholder:text-subtle-foreground focus:border-primary focus:ring-primary h-9 w-full rounded-xl border pr-4 pl-9 text-xs focus:ring-1 focus:outline-none"
            />
          </div>

          {/* Filtres déroulants */}
          <div className="flex items-center gap-2">
            <SelectField
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border-border bg-surface-raised text-foreground focus:border-primary focus:ring-primary h-9 rounded-xl border px-2.5 py-1 text-xs focus:ring-1 focus:outline-none"
            >
              <option value="all">Toutes catégories</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </SelectField>

            <SelectField
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as 'all' | 'low' | 'ok')}
              className="border-border bg-surface-raised text-foreground focus:border-primary focus:ring-primary h-9 rounded-xl border px-2.5 py-1 text-xs focus:ring-1 focus:outline-none"
            >
              <option value="all">Tous niveaux</option>
              <option value="low">⚠️ Stock faible</option>
              <option value="ok">✅ Stock suffisant</option>
            </SelectField>
          </div>
        </div>
      </div>

      {/* Tableau compact sans scroll horizontal */}
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-border bg-surface-raised/50 text-muted-foreground text-3xs border-b font-bold tracking-wider uppercase">
            <th className="px-3 py-2.5 sm:px-4">Article &amp; Réf.</th>
            <th className="px-3 py-2.5 text-center sm:text-left">Stock &amp; Seuil</th>
            <th className="hidden px-3 py-2.5 text-right md:table-cell">Valorisation HT</th>
            <th className="px-3 py-2.5 text-center">Ajustement</th>
            <th className="px-3 py-2.5 text-right sm:px-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {filteredItems.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-muted-foreground py-10 text-center">
                <p className="text-sm font-semibold">Aucun article trouvé</p>
                <p className="text-2xs text-subtle-foreground mt-1">
                  Modifiez votre recherche ou créez un nouvel article.
                </p>
              </td>
            </tr>
          ) : (
            filteredItems.map((item) => {
              const isLow = item.quantityInStock <= item.minThreshold;
              const totalItemValue = item.quantityInStock * (item.unitPriceEur ?? 0);

              return (
                <tr key={item.id} className="hover:bg-surface-hover/50 group transition-colors">
                  {/* 1. Article, Réf, Catégorie & Emplacement */}
                  <td className="px-3 py-3 sm:px-4">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className="bg-surface-raised border-border text-3xs text-foreground rounded-md border px-1.5 py-0.5 font-mono font-bold">
                        {item.reference}
                      </span>
                      <Badge variant="outline" className="text-3xs px-1.5 py-0">
                        {item.category}
                      </Badge>
                    </div>
                    <p className="text-foreground text-xs leading-snug font-semibold">
                      {item.name}
                    </p>
                    <div className="text-3xs text-subtle-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>📍 {item.location}</span>
                      {item.supplier && <span>• Fournisseur : {item.supplier}</span>}
                    </div>
                  </td>

                  {/* 2. Stock & Seuil */}
                  <td className="px-3 py-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-sm font-bold ${
                            isLow ? 'text-warning font-extrabold' : 'text-foreground'
                          }`}
                        >
                          {item.quantityInStock}
                        </span>
                        <span className="text-3xs text-muted-foreground font-semibold uppercase">
                          {item.unit}
                        </span>
                        {isLow && (
                          <span
                            title={`Sous le seuil d'alerte de ${item.minThreshold} ${item.unit}`}
                          >
                            <AlertTriangle className="text-warning size-3.5 shrink-0" />
                          </span>
                        )}
                      </div>
                      <span className="text-3xs text-subtle-foreground">
                        Seuil min : {item.minThreshold} {item.unit}
                      </span>
                    </div>
                  </td>

                  {/* 3. Valorisation */}
                  <td className="hidden px-3 py-3 text-right md:table-cell">
                    <p className="text-foreground font-bold">
                      {item.unitPriceEur !== undefined ? `${totalItemValue.toFixed(2)} €` : '—'}
                    </p>
                    <p className="text-3xs text-subtle-foreground">
                      {item.unitPriceEur !== undefined
                        ? `${item.unitPriceEur.toFixed(2)} € / ${item.unit}`
                        : '—'}
                    </p>
                  </td>

                  {/* 4. Ajustement rapide */}
                  <td className="px-3 py-3 text-center">
                    <div className="bg-surface-raised border-border inline-flex items-center gap-0.5 rounded-lg border p-0.5">
                      <button
                        type="button"
                        onClick={() => onQuickAdjust(item.id, -1)}
                        disabled={item.quantityInStock <= 0}
                        title="Consommer 1 (-1)"
                        className="text-muted-foreground hover:bg-surface-hover hover:text-foreground flex size-10 cursor-pointer items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30 sm:size-7"
                      >
                        <Minus className="size-2.5" />
                      </button>
                      <span className="text-2xs text-foreground px-1 font-mono font-semibold">
                        {item.quantityInStock}
                      </span>
                      <button
                        type="button"
                        onClick={() => onQuickAdjust(item.id, 1)}
                        title="Ajouter 1 (+1)"
                        className="text-muted-foreground hover:bg-surface-hover hover:text-foreground flex size-10 cursor-pointer items-center justify-center rounded-md transition-colors sm:size-7"
                      >
                        <Plus className="size-2.5" />
                      </button>
                    </div>
                  </td>

                  {/* 5. Actions */}
                  <td className="px-3 py-3 text-right sm:px-4">
                    <div className="flex items-center justify-end gap-1">
                      {onOrder && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOrder(item)}
                          title="Commander auprès du fournisseur"
                          className="text-warning hover:bg-warning/10 size-10 cursor-pointer p-0 sm:size-8"
                        >
                          <ShoppingCart className="size-3.5" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRecordMovement(item, 'in')}
                        title="Déclarer une entrée (BL)"
                        className="text-success hover:bg-success/10 size-10 cursor-pointer p-0 sm:size-8"
                      >
                        <ArrowDownLeft className="size-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRecordMovement(item, 'out')}
                        title="Déclarer une sortie chantier"
                        className="text-error hover:bg-error/10 size-10 cursor-pointer p-0 sm:size-8"
                      >
                        <ArrowUpRight className="size-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(item)}
                        title="Modifier l'article"
                        className="text-muted-foreground hover:text-foreground size-10 cursor-pointer p-0 sm:size-8"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (
                            confirm(
                              `Êtes-vous sûr de vouloir supprimer l'article « ${item.name} » ?`,
                            )
                          ) {
                            onDelete(item.id);
                          }
                        }}
                        title="Supprimer l'article"
                        className="text-muted-foreground hover:text-error size-10 cursor-pointer p-0 sm:size-8"
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
