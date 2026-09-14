import { AlertTriangle, ArrowDownLeft, ShoppingCart } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { StockConsumable } from '../types/stock.types';

interface StockAlertsBannerProps {
  lowStockArticles: StockConsumable[];
  onOrder: (article: StockConsumable) => void;
  onMovement: (article: StockConsumable) => void;
}

export function StockAlertsBanner({
  lowStockArticles,
  onOrder,
  onMovement,
}: StockAlertsBannerProps) {
  if (lowStockArticles.length === 0) return null;

  return (
    <div className="border-warning/30 bg-warning/5 dark:bg-warning/10 rounded-2xl border p-4 sm:p-5">
      <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="bg-warning/20 text-warning flex size-8 shrink-0 items-center justify-center rounded-xl">
            <AlertTriangle className="size-4.5" />
          </div>
          <div>
            <h3 className="text-foreground text-sm font-bold">
              {lowStockArticles.length}{' '}
              {lowStockArticles.length > 1
                ? 'articles sous le seuil critique'
                : 'article sous le seuil critique'}
            </h3>
            <p className="text-muted-foreground text-xs">
              Passez commande auprès de vos fournisseurs ou déclarez une entrée directe en stock.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 pt-1 sm:grid-cols-2 lg:grid-cols-3">
        {lowStockArticles.map((article) => (
          <div
            key={article.id}
            className="border-warning/20 bg-surface/80 flex flex-col justify-between gap-2.5 rounded-xl border p-3 shadow-2xs backdrop-blur-xs"
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-1.5">
                <span className="text-3xs text-muted-foreground font-mono font-bold uppercase">
                  {article.reference}
                </span>
                <Badge variant="warning" className="text-3xs px-1.5 py-0">
                  Reste : {article.quantityInStock} {article.unit}
                </Badge>
              </div>
              <p className="text-foreground truncate text-xs font-semibold" title={article.name}>
                {article.name}
              </p>
              <p className="text-3xs text-subtle-foreground mt-0.5">
                Seuil min. : {article.minThreshold} {article.unit} • {article.location}
              </p>
            </div>

            <div className="border-border/40 flex items-center justify-end gap-1.5 border-t pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onMovement(article)}
                className="text-2xs text-muted-foreground hover:text-foreground h-11 cursor-pointer gap-1 px-2 font-medium sm:h-7"
                title="Déclarer une entrée / mouvement direct"
              >
                <ArrowDownLeft className="text-success size-3" />
                <span>Mouvement</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => onOrder(article)}
                className="border-warning/40 bg-warning/10 text-2xs text-warning hover:bg-warning/20 hover:text-warning h-11 cursor-pointer gap-1 px-2.5 font-bold shadow-2xs sm:h-7"
                title="Créer un bon de commande dans le volet Achats"
              >
                <ShoppingCart className="size-3" />
                <span>Commander</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
