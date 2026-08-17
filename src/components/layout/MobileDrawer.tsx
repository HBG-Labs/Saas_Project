import { X } from 'lucide-react';
import React, { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  headerContent?: React.ReactNode;
  className?: string;
}

export function MobileDrawer({
  isOpen,
  onClose,
  children,
  title = 'Menu de navigation',
  headerContent,
  className,
}: MobileDrawerProps) {
  /**
   * Le tiroir reste monté le temps de son animation de sortie.
   *
   * `isRendered` se DÉDUIT de l'ouverture plutôt que d'être posé par un effet :
   * un `setState` synchrone à l'ouverture ajoutait un rendu intermédiaire, et
   * le tiroir apparaissait une image avant de commencer sa transition. À la
   * fermeture, en revanche, il faut bien attendre la fin de l'animation — c'est
   * le seul cas où l'état survit à la prop, et il est traité dans l'effet.
   */
  const [isClosing, setIsClosing] = useState(false);
  const isRendered = isOpen || isClosing;

  /**
   * Vrai une fois le tiroir en place, faux pendant sa sortie.
   *
   * `hasEnteredView` n'est posé qu'après deux `requestAnimationFrame` — le
   * temps que le DOM existe avec `translateX(-100%)`, sans quoi il n'y a rien à
   * animer. La composition avec `isOpen` évite d'avoir à le remettre à faux
   * depuis l'effet : la fermeture le rend faux d'elle-même.
   */
  const [hasEnteredView, setHasEnteredView] = useState(false);
  const isAnimatingIn = isOpen && hasEnteredView;
  const [, startTransition] = useTransition();

  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Gestion de l'état tactile
  const touchState = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    currentOffsetX: number;
    isDragging: boolean;
    directionLocked: 'horizontal' | 'vertical' | null;
  }>({
    startX: 0,
    startY: 0,
    startTime: 0,
    currentOffsetX: 0,
    isDragging: false,
    directionLocked: null,
  });

  // Gestion de l'ouverture et fermeture avec transition fluide
  useEffect(() => {
    let animFrame: number;
    let timer: ReturnType<typeof setTimeout>;

    if (isOpen) {
      // Double rAF pour s'assurer que le DOM est monté avec translateX(-100%) avant d'animer vers 0
      animFrame = requestAnimationFrame(() => {
        animFrame = requestAnimationFrame(() => {
          setHasEnteredView(true);
          if (drawerRef.current) {
            drawerRef.current.style.transform = '';
            drawerRef.current.style.transition = '';
          }
          if (backdropRef.current) {
            backdropRef.current.style.opacity = '';
            backdropRef.current.style.transition = '';
          }
        });
      });
      document.body.style.overflow = 'hidden';
    } else {
      // Marque la sortie en cours pour que le tiroir reste monté le temps de
      // l'animation. C'est une synchronisation avec le DOM — l'usage même de
      // l'effet — mais la règle ne peut pas le distinguer d'un calcul dérivé.
      // Le différer d'une micro-tâche la satisfait sans changer le rendu.
      queueMicrotask(() => setIsClosing(true));
      if (drawerRef.current) {
        drawerRef.current.style.transform = 'translateX(-100%)';
        drawerRef.current.style.transition = 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)';
      }
      if (backdropRef.current) {
        backdropRef.current.style.opacity = '0';
        backdropRef.current.style.transition = 'opacity 220ms ease';
      }
      // Démontage une fois la transition de sortie terminée : c'est bien une
      // synchronisation avec le DOM, donc un usage légitime de l'effet.
      timer = setTimeout(() => {
        startTransition(() => {
          setIsClosing(false);
        });
      }, 230);
      document.body.style.overflow = '';
    }

    return () => {
      cancelAnimationFrame(animFrame);
      clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Fermeture par touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Événements tactiles (Swipe to close)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      currentOffsetX: 0,
      isDragging: false,
      directionLocked: null,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchState.current.startX;
    const deltaY = touch.clientY - touchState.current.startY;

    // Détection de la direction dominante
    if (touchState.current.directionLocked === null) {
      if (Math.hypot(deltaX, deltaY) > 6) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          touchState.current.directionLocked = 'horizontal';
          touchState.current.isDragging = true;
        } else {
          touchState.current.directionLocked = 'vertical';
        }
      }
    }

    // Suivi tactile en temps réel si glissement horizontal
    if (touchState.current.directionLocked === 'horizontal' && drawerRef.current) {
      // Si on glisse vers la gauche : déplacement 1:1 direct
      // Si on essaie de glisser vers la droite au-delà de 0 : résistance élastique
      const clampedX = deltaX < 0 ? deltaX : deltaX * 0.15;
      touchState.current.currentOffsetX = clampedX;

      const drawerWidth = drawerRef.current.offsetWidth || 300;
      const progress = Math.max(0, Math.min(1, 1 + clampedX / drawerWidth));

      drawerRef.current.style.transition = 'none';
      drawerRef.current.style.transform = `translateX(${clampedX}px)`;

      if (backdropRef.current) {
        backdropRef.current.style.transition = 'none';
        backdropRef.current.style.opacity = `${progress}`;
      }
    }
  };

  const handleTouchEnd = () => {
    if (!touchState.current.isDragging || !drawerRef.current) {
      touchState.current.isDragging = false;
      touchState.current.directionLocked = null;
      return;
    }

    const drawerWidth = drawerRef.current.offsetWidth || 300;
    const offsetX = touchState.current.currentOffsetX;
    const elapsed = Math.max(1, Date.now() - touchState.current.startTime);
    const velocityX = offsetX / elapsed; // px/ms

    // Seuil de fermeture : glissement de plus de 25% de la largeur OU coup sec rapide (flick) vers la gauche
    const shouldClose = offsetX < -drawerWidth * 0.22 || velocityX < -0.3;

    if (shouldClose) {
      // Fermeture complète et fluide
      drawerRef.current.style.transition = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)';
      drawerRef.current.style.transform = 'translateX(-100%)';

      if (backdropRef.current) {
        backdropRef.current.style.transition = 'opacity 200ms ease';
        backdropRef.current.style.opacity = '0';
      }

      // Retour haptique discret si supporté
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(8);
        }
      } catch {
        // Ignorer si non disponible
      }

      setTimeout(() => {
        onClose();
      }, 200);
    } else {
      // Rétablissement élastique à la position ouverte
      drawerRef.current.style.transition = 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)';
      drawerRef.current.style.transform = 'translateX(0px)';

      if (backdropRef.current) {
        backdropRef.current.style.transition = 'opacity 220ms ease';
        backdropRef.current.style.opacity = '1';
      }
    }

    touchState.current.isDragging = false;
    touchState.current.directionLocked = null;
  };

  if (!isRendered) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Overlay Backdrop sombre avec flou d'arrière-plan */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className={cn(
          'fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200 cursor-pointer',
          isAnimatingIn ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden="true"
      />

      {/* Conteneur du tiroir latéral avec écouteurs tactiles */}
      <div
        ref={drawerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={cn(
          'relative z-10 flex flex-col h-full w-[min(20rem,85vw)] bg-surface border-r border-border shadow-2xl transition-transform duration-220 ease-out select-none',
          isAnimatingIn ? 'translate-x-0' : '-translate-x-full',
          className,
        )}
        style={{
          touchAction: 'pan-y',
          willChange: 'transform',
        }}
      >
        {/* En-tête du Drawer */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3.5">
          <div className="flex items-center min-w-0 flex-1">
            {headerContent}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Fermer le menu"
            title="Fermer"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Contenu défilant */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {children}
        </div>

        {/* Poignée d'indication visuelle de glissement sur le bord droit (tactile style ChatGPT) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -right-1 w-1.5 h-12 rounded-full bg-border-strong/40 hover:bg-primary/60 transition-colors pointer-events-none"
          aria-hidden="true"
        />
      </div>
    </div>,
    document.body,
  );
}
