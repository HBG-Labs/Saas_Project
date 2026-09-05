import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ScrollRevealSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function ScrollRevealSection({
  children,
  className = '',
  delay = 0,
}: ScrollRevealSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const observerSupported =
    typeof window !== 'undefined' && typeof IntersectionObserver !== 'undefined';
  const [isVisible, setIsVisible] = useState(!observerSupported);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Sécurité SSR / environnements de test jsdom
    if (!observerSupported) return;

    // Utilisation d'un IntersectionObserver haute performance
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [observerSupported]);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
      }}
      /*
        Les variantes `motion-reduce:` ne sont pas une politesse.

        Mesuré au navigateur : avec « réduire les animations » activé au niveau
        du système, ces sections gardaient exactement les mêmes valeurs —
        décalage de 32 px, flou de 2 px, fondu sur 700 ms. Or c'est précisément
        ce glissement qui gêne les personnes sujettes aux troubles
        vestibulaires, et six sections s'enchaînent au défilement.

        `index.css` neutralisait déjà les animations d'entrée sous cette
        préférence, mais la règle ne couvrait que les utilitaires `animate-*` :
        une transition écrite en classes y échappait.

        Le contenu apparaît alors d'emblée, sans transition — il n'est jamais
        masqué, seulement non animé.
      */
      className={`transform transition-all duration-700 ease-out motion-reduce:transition-none ${
        isVisible
          ? 'opacity-100 translate-y-0 filter-none'
          : 'opacity-0 translate-y-8 filter blur-[2px] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-none'
      } ${className}`}
    >
      {children}
    </div>
  );
}
