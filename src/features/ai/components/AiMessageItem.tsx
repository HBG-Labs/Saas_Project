import { Check, Copy, Info, RotateCcw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState, type ReactNode } from 'react';

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
        <li
          key={idx}
          className="text-foreground/90 my-0.5 ml-4 list-disc text-xs leading-relaxed sm:text-sm"
        >
          <span>{formatInline(line.slice(2))}</span>
        </li>
      );
    }
    if (/^\d+\.\s/.test(line)) {
      return (
        <li
          key={idx}
          className="text-foreground/90 my-0.5 ml-4 list-decimal text-xs leading-relaxed sm:text-sm"
        >
          <span>{formatInline(line.replace(/^\d+\.\s/, ''))}</span>
        </li>
      );
    }
    if (!line.trim()) {
      return <div key={idx} className="h-2" />;
    }
    return (
      <p key={idx} className="text-foreground/90 text-xs leading-relaxed sm:text-sm">
        {formatInline(line)}
      </p>
    );
  });
}

/**
 * Transforme uniquement les trois marqueurs markdown pris en charge en noeuds
 * React. Le contenu reste du texte : une réponse IA contenant du HTML ne doit
 * jamais atteindre `innerHTML`, même si elle provient d'un document importé.
 */
function formatInline(text: string): ReactNode[] {
  const tokenPattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const start = match.index;
    const token = match[0];

    if (start > cursor) nodes.push(text.slice(cursor, start));

    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`${start}-code`}
          className="bg-surface-sunken border-border text-2xs text-primary rounded-md border px-1.5 py-0.5 font-mono"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${start}-strong`} className="text-foreground font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <em key={`${start}-em`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }

    cursor = start + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
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
        <div className="bg-surface-raised border-border/80 text-foreground max-w-[85%] rounded-3xl border px-4 py-2.5 text-xs leading-relaxed font-normal shadow-2xs sm:max-w-[75%] sm:text-sm">
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex w-full flex-col gap-2 text-xs sm:text-sm">
      {/* En-tête discret assistant */}
      <div className="text-2xs text-muted-foreground flex items-center gap-2 font-semibold">
        <div className="bg-primary/10 text-primary flex size-5 items-center justify-center rounded-full">
          <Sparkles className="size-3" />
        </div>
        <span>Assistant REZO360</span>
      </div>

      {/* Contenu formaté sans encadrement lourd */}
      <div className="text-foreground space-y-1 pl-1">
        {renderFormattedContent(message.content)}
      </div>

      {/* Actions suggérées si disponibles */}
      {message.suggestedActions && message.suggestedActions.length > 0 && (
        <div className="mt-2 max-w-xl space-y-2">
          {message.suggestedActions.map((action) => (
            <AiActionCard key={action.id} action={action} onExecute={onExecuteAction} />
          ))}
        </div>
      )}

      {/* Sources / Traçabilité */}
      {message.sources && message.sources.length > 0 && (
        <div className="text-muted-foreground text-2xs mt-1 flex items-center gap-1.5 opacity-80">
          <Info className="size-3 shrink-0" />
          <span>Sources : {message.sources.join(', ')}</span>
        </div>
      )}

      {/* Barre d'actions style ChatGPT (copier, feedback, relancer) */}
      <div className="mt-1 flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={handleCopy}
          className="text-subtle-foreground hover:bg-surface-hover hover:text-foreground flex size-7 cursor-pointer items-center justify-center rounded-lg transition-colors"
          title={copied ? 'Copié !' : 'Copier'}
          aria-label="Copier la réponse"
        >
          {copied ? <Check className="text-success size-3.5" /> : <Copy className="size-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => setFeedback((prev) => (prev === 'like' ? null : 'like'))}
          className={cn(
            'flex size-7 cursor-pointer items-center justify-center rounded-lg transition-colors',
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
            'flex size-7 cursor-pointer items-center justify-center rounded-lg transition-colors',
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
            className="text-subtle-foreground hover:bg-surface-hover hover:text-foreground flex size-7 cursor-pointer items-center justify-center rounded-lg transition-colors"
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
