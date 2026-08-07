import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendu affiché à la place des enfants lorsqu'une erreur est capturée. */
  fallback: (args: { error: Error; reset: () => void }) => ReactNode;
  onError?: ((error: Error, info: ErrorInfo) => void) | undefined;
  /**
   * Réinitialise automatiquement la frontière lorsque l'une de ces valeurs
   * change. Typiquement le slug de l'outil affiché : naviguer vers un autre
   * outil ne doit pas conserver l'erreur du précédent.
   */
  resetKeys?: readonly unknown[] | undefined;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function keysChanged(
  a: readonly unknown[] | undefined,
  b: readonly unknown[] | undefined,
): boolean {
  if (a === b) return false;
  if (!a || !b || a.length !== b.length) return true;
  return a.some((value, index) => !Object.is(value, b[index]));
}

/**
 * Frontière d'erreur réutilisable.
 *
 * React n'offre pas d'équivalent en composant fonction : capturer une erreur de
 * rendu impose encore un composant de classe.
 *
 * Cette frontière est volontairement générique et sans style : la portée de
 * l'isolation (page entière, ou seulement la zone d'un outil) est décidée par
 * l'appelant, selon ce qui doit survivre au crash.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    console.error('[error-boundary]', error.message, info.componentStack);
  }

  override componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.error === null) return;

    if (keysChanged(previous.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;

    if (error !== null) {
      return this.props.fallback({ error, reset: this.reset });
    }

    return this.props.children;
  }
}
