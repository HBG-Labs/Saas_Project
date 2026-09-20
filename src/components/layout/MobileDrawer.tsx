import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import React, { useRef } from 'react';

import { cn } from '@/lib/cn';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  headerContent?: React.ReactNode;
  className?: string;
}

/**
 * Menu latéral mobile.
 *
 * Radix prend en charge le piège et la restitution du focus, Échap,
 * l'inertie du reste de la page et le verrouillage du défilement. Le geste de
 * balayage reste local au panneau afin de conserver le comportement mobile
 * déjà connu des utilisateurs.
 */
export function MobileDrawer({
  isOpen,
  onClose,
  children,
  title = 'Menu de navigation',
  headerContent,
  className,
}: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

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

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

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

    if (touchState.current.directionLocked === null && Math.hypot(deltaX, deltaY) > 6) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        touchState.current.directionLocked = 'horizontal';
        touchState.current.isDragging = true;
      } else {
        touchState.current.directionLocked = 'vertical';
      }
    }

    if (touchState.current.directionLocked !== 'horizontal' || !drawerRef.current) return;

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
  };

  const resetTouchStyles = () => {
    if (drawerRef.current) {
      drawerRef.current.style.transition = '';
      drawerRef.current.style.transform = '';
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = '';
      backdropRef.current.style.opacity = '';
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
    const shouldClose = offsetX < -drawerWidth * 0.22 || offsetX / elapsed < -0.3;

    if (shouldClose) {
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200;
      drawerRef.current.style.transition = `transform ${duration}ms cubic-bezier(0.32, 0.72, 0, 1)`;
      drawerRef.current.style.transform = 'translateX(-100%)';
      if (backdropRef.current) {
        backdropRef.current.style.transition = `opacity ${duration}ms ease`;
        backdropRef.current.style.opacity = '0';
      }

      try {
        navigator.vibrate?.(8);
      } catch {
        // L'haptique est un bonus et certains navigateurs la refusent.
      }

      window.setTimeout(onClose, duration);
    } else {
      resetTouchStyles();
    }

    touchState.current.isDragging = false;
    touchState.current.directionLocked = null;
  };

  const handleTouchCancel = () => {
    resetTouchStyles();
    touchState.current.isDragging = false;
    touchState.current.directionLocked = null;
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          ref={backdropRef}
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 fixed inset-0 z-50 cursor-pointer bg-black/60 backdrop-blur-xs duration-200 lg:hidden"
        />

        <Dialog.Content
          ref={drawerRef}
          onOpenAutoFocus={() => {
            previousFocusRef.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            previousFocusRef.current?.focus();
            previousFocusRef.current = null;
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          className={cn(
            'border-border bg-surface shadow-overlay fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(20rem,85vw)] flex-col border-r select-none lg:hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left duration-200',
            'focus-visible:outline-none',
            className,
          )}
          style={{ touchAction: 'pan-y', willChange: 'transform' }}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">
            Navigation principale de REZO360
          </Dialog.Description>

          <div className="border-border flex h-14 shrink-0 items-center justify-between border-b px-3.5">
            <div className="flex min-w-0 flex-1 items-center">{headerContent}</div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="text-muted-foreground hover:bg-surface-hover hover:text-foreground size-touch ml-2 flex shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors sm:size-9"
                aria-label="Fermer le menu"
                title="Fermer"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</div>

          <div
            className="bg-border-strong/40 pointer-events-none absolute top-1/2 -right-1 h-12 w-1.5 -translate-y-1/2 rounded-full transition-colors"
            aria-hidden="true"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
