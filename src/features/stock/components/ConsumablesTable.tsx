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

      const matchesCategory =
        categoryFilter === 'all' || item.category === categoryFilter;

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
      <div className="p-3 sm:p-4 border-b border-border space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Champ de recherche */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par référence, désignation, emplacement, fournisseur…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-xl border border-border bg-surface-raised pl-9 pr-4 text-xs text-foreground placeholder:text-subtle-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filtres déroulants */}
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 rounded-xl border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Toutes catégories</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as 'all' | 'low' | 'ok')}
              className="h-9 rounded-xl border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Tous niveaux</option>
              <option value="low">⚠️ Stock faible</option>
              <option value="ok">✅ Stock suffisant</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tableau compact sans scroll horizontal */}
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface-raised/50 text-muted-foreground text-3xs font-bold uppercase tracking-wider">
            <th className="py-2.5 px-3 sm:px-4">Article &amp; Réf.</th>
            <th className="py-2.5 px-3 text-center sm:text-left">Stock &amp; Seuil</th>
            <th className="py-2.5 px-3 text-right hidden md:table-cell">Valorisation HT</th>
            <th className="py-2.5 px-3 text-center">Ajustement</th>
            <th className="py-2.5 px-3 sm:px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filteredItems.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-10 text-center text-muted-foreground">
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
                <tr
                  key={item.id}
                  className="hover:bg-surface-hover/50 transition-colors group"
                >
                  {/* 1. Article, Réf, Catégorie & Emplacement */}
                  <td className="py-3 px-3 sm:px-4">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="rounded-md bg-surface-raised px-1.5 py-0.5 border border-border text-3xs font-mono font-bold text-foreground">
                        {item.reference}
                      </span>
                      <Badge variant="outline" className="text-3xs py-0 px-1.5">
                        {item.category}
                      </Badge>
                    </div>
                    <p className="font-semibold text-foreground text-xs leading-snug">
                      {item.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-3xs text-subtle-foreground mt-0.5">
                      <span>📍 {item.location}</span>
                      {item.supplier && <span>• Fournisseur : {item.supplier}</span>}
                    </div>
                  </td>

                  {/* 2. Stock & Seuil */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold text-sm ${
                            isLow ? 'text-warning font-extrabold' : 'text-foreground'
                          }`}
                        >
                          {item.quantityInStock}
                        </span>
                        <span className="text-3xs text-muted-foreground uppercase font-semibold">
                          {item.unit}
                        </span>
                        {isLow && (
                          <span title={`Sous le seuil d'alerte de ${item.minThreshold} ${item.unit}`}>
                            <AlertTriangle className="size-3.5 text-warning shrink-0" />
                          </span>
                        )}
                      </div>
                      <span className="text-3xs text-subtle-foreground">
                        Seuil min : {item.minThreshold} {item.unit}
                      </span>
                    </div>
                  </td>

                  {/* 3. Valorisation */}
                  <td className="py-3 px-3 text-right hidden md:table-cell">
                    <p className="font-bold text-foreground">
                      {item.unitPriceEur !== undefined
                        ? `${totalItemValue.toFixed(2)} €`
                        : '—'}
                    </p>
                    <p className="text-3xs text-subtle-foreground">
                      {item.unitPriceEur !== undefined
                        ? `${item.unitPriceEur.toFixed(2)} € / ${item.unit}`
                        : '—'}
                    </p>
                  </td>

                  {/* 4. Ajustement rapide */}
                  <td className="py-3 px-3 text-center">
                    <div className="inline-flex items-center gap-0.5 bg-surface-raised rounded-lg p-0.5 border border-border">
                      <button
                        type="button"
                        onClick={() => onQuickAdjust(item.id, -1)}
                        disabled={item.quantityInStock <= 0}
                        title="Consommer 1 (-1)"
                        className="flex size-5.5 items-center justify-center rounded hover:bg-surface-hover text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <Minus className="size-2.5" />
                      </button>
                      <span className="text-2xs font-mono px-1 font-semibold text-foreground">
                        {item.quantityInStock}
                      </span>
                      <button
                        type="button"
                        onClick={() => onQuickAdjust(item.id, 1)}
                        title="Ajouter 1 (+1)"
                        className="flex size-5.5 items-center justify-center rounded hover:bg-surface-hover text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      >
                        <Plus className="size-2.5" />
                      </button>
                    </div>
                  </td>

                  {/* 5. Actions */}
                  <td className="py-3 px-3 sm:px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onOrder && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOrder(item)}
                          title="Commander auprès du fournisseur"
                          className="size-6.5 p-0 text-warning hover:bg-warning/10 cursor-pointer"
                        >
                          <ShoppingCart className="size-3.5" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRecordMovement(item, 'in')}
                        title="Déclarer une entrée (BL)"
                        className="size-6.5 p-0 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                      >
                        <ArrowDownLeft className="size-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRecordMovement(item, 'out')}
                        title="Déclarer une sortie chantier"
                        className="size-6.5 p-0 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <ArrowUpRight className="size-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(item)}
                        title="Modifier l'article"
                        className="size-6.5 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
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
                        className="size-6.5 p-0 text-muted-foreground hover:text-error cursor-pointer"
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
