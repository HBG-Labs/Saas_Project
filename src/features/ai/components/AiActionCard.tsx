import { ArrowRight, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

import type { AiProposedAction } from '../types/ai.types';

interface AiActionCardProps {
  action: AiProposedAction;
  onExecute: (actionId: string, confirmed: boolean) => void;
}

export function AiActionCard({ action, onExecute }: AiActionCardProps) {
  const isCompleted = action.status === 'completed';
  const isRejected = action.status === 'rejected';

  return (
    <div className="border-border bg-surface-sunken/60 hover:bg-surface-sunken my-2.5 rounded-xl border p-3.5 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {action.requiresConfirmation ? (
            <ShieldAlert className="text-warning size-4 shrink-0" />
          ) : (
            <ArrowRight className="text-primary size-4 shrink-0" />
          )}
          <span className="text-foreground text-xs font-semibold">{action.title}</span>
        </div>

        {isCompleted ? (
          <Badge variant="success" className="text-2xs gap-1">
            <CheckCircle2 className="size-3" />
            Exécuté
          </Badge>
        ) : isRejected ? (
          <Badge variant="neutral" className="text-2xs gap-1">
            <XCircle className="size-3" />
            Ignoré
          </Badge>
        ) : action.requiresConfirmation ? (
          <Badge variant="warning" className="text-2xs">
            Confirmation requise
          </Badge>
        ) : null}
      </div>

      <p className="text-muted-foreground mt-1 text-xs">{action.description}</p>

      {action.status === 'idle' && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {action.requiresConfirmation ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onExecute(action.id, false)}
                className="h-11 text-xs sm:h-7"
              >
                Refuser
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onExecute(action.id, true)}
                className="h-11 text-xs font-semibold sm:h-7"
              >
                Confirmer l’action
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExecute(action.id, true)}
              className="h-11 text-xs sm:h-7"
            >
              Accéder <ArrowRight className="size-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
