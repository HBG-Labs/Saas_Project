import {
  Check,
  Copy,
  Info,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';

import type { AiMessage } from '../types/ai.types';

import { AiActionCard } from './AiActionCard';

interface AiMessageItemProps {
  message: AiMessage;
  onExecuteAction: (actionId: string, confirmed: boolean) => void;
  onRetry?: () => void;
}

/**
 * Formatage simple du markdown (titres, listes, gras, italique, code) sans dépendance lourde externe.
 */
function renderFormattedContent(content: string) {
  const lines = content.split('\n');

  return lines.map((line, idx) => {
    if (line.startsWith('### ')) {
      return (
        <h4 key={idx} className="text-foreground mt-3 mb-1 text-xs font-bold sm:text-sm">
          {line.replace('### ', '')}
        </h4>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3 key={idx} className="text-foreground mt-4 mb-1.5 text-sm font-bold sm:text-base">
          {line.replace('## ', '')}
        </h3>
      );
    }
    if (line.startsWith('* ') || line.startsWith('- ')) {
      return (
        <li key={idx} className="ml-4 list-disc text-xs leading-relaxed sm:text-sm text-foreground/90 my-0.5">
          <span dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
        </li>
      );
    }
    if (/^\d+\.\s/.test(line)) {
      return (
        <li key={idx} className="ml-4 list-decimal text-xs leading-relaxed sm:text-sm text-foreground/90 my-0.5">
          <span dangerouslySetInnerHTML={{ __html: formatInline(line.replace(/^\d+\.\s/, '')) }} />
        </li>
      );
    }
    if (!line.trim()) {
      return <div key={idx} className="h-2" />;
    }
    return (
      <p
        key={idx}
        className="text-xs leading-relaxed sm:text-sm text-foreground/90"
        dangerouslySetInnerHTML={{ __html: formatInline(line) }}
      />
    );
  });
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    .replace(
      /`([^`]+)`/g,
      '<code class="rounded-md bg-surface-sunken border border-border px-1.5 py-0.5 font-mono text-2xs text-primary">$1</code>',
    );
}

export function AiMessageItem({ message, onExecuteAction, onRetry }: AiMessageItemProps) {
  const isUser = message.role === 'user';
  const [copied, signalerCopied] = useEphemeralFlag();
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      signalerCopied();
    } catch {
      // Ignore clipboard write failure
    }
  };

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-3xl bg-surface-raised border border-border/80 text-foreground px-4 py-2.5 text-xs sm:text-sm font-normal leading-relaxed shadow-2xs">
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex w-full flex-col gap-2 text-xs sm:text-sm">
      {/* En-tête discret assistant */}
      <div className="flex items-center gap-2 text-2xs font-semibold text-muted-foreground">
        <div className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-3" />
        </div>
        <span>Assistant REZO360</span>
      </div>

      {/* Contenu formaté sans encadrement lourd */}
      <div className="space-y-1 pl-1 text-foreground">
        {renderFormattedContent(message.content)}
      </div>

      {/* Actions suggérées si disponibles */}
      {message.suggestedActions && message.suggestedActions.length > 0 && (
        <div className="mt-2 space-y-2 max-w-xl">
          {message.suggestedActions.map((action) => (
            <AiActionCard key={action.id} action={action} onExecute={onExecuteAction} />
          ))}
        </div>
      )}

      {/* Sources / Traçabilité */}
      {message.sources && message.sources.length > 0 && (
        <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-2xs opacity-80">
          <Info className="size-3 shrink-0" />
          <span>Sources : {message.sources.join(', ')}</span>
        </div>
      )}

      {/* Barre d'actions style ChatGPT (copier, feedback, relancer) */}
      <div className="mt-1 flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={handleCopy}
          className="flex size-7 items-center justify-center rounded-lg text-subtle-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
          title={copied ? 'Copié !' : 'Copier'}
          aria-label="Copier la réponse"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => setFeedback((prev) => (prev === 'like' ? null : 'like'))}
          className={cn(
            'flex size-7 items-center justify-center rounded-lg transition-colors cursor-pointer',
            feedback === 'like'
              ? 'text-primary bg-primary/10'
              : 'text-subtle-foreground hover:bg-surface-hover hover:text-foreground',
          )}
          title="Bonne réponse"
          aria-label="Bonne réponse"
        >
          <ThumbsUp className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setFeedback((prev) => (prev === 'dislike' ? null : 'dislike'))}
          className={cn(
            'flex size-7 items-center justify-center rounded-lg transition-colors cursor-pointer',
            feedback === 'dislike'
              ? 'text-error bg-error/10'
              : 'text-subtle-foreground hover:bg-surface-hover hover:text-foreground',
          )}
          title="Mauvaise réponse"
          aria-label="Mauvaise réponse"
        >
          <ThumbsDown className="size-3.5" />
        </button>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex size-7 items-center justify-center rounded-lg text-subtle-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
            title="Régénérer"
            aria-label="Régénérer la réponse"
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
