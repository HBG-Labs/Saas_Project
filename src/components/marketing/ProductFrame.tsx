import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface ProductFrameProps {
  src: string;
  mobileSrc?: string | undefined;
  alt: string;
  label: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  children?: ReactNode;
}

/**
 * Cadre de présentation commun aux captures produit de la vitrine.
 * La capture reste l'élément principal : aucun filtre ne vient la masquer.
 */
export function ProductFrame({
  src,
  mobileSrc,
  alt,
  label,
  className,
  imageClassName,
  priority = false,
  width = 1440,
  height = 960,
  children,
}: ProductFrameProps) {
  return (
    <figure className={cn('lp-product-frame', className)}>
      <div className="lp-product-frame__bar" aria-hidden="true">
        <span className="lp-product-frame__lights">
          <i />
          <i />
          <i />
        </span>
        <span className="lp-product-frame__label">{label}</span>
        <span className="lp-product-frame__secure">REZO360</span>
      </div>
      <div className="lp-product-frame__canvas">
        <picture>
          {mobileSrc && <source media="(max-width: 640px)" srcSet={mobileSrc} />}
          <img
            src={src}
            alt={alt}
            className={cn('lp-product-frame__image', imageClassName)}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
          />
        </picture>
        {children}
      </div>
      <figcaption className="sr-only">Capture réelle de l’application REZO360.</figcaption>
    </figure>
  );
}
