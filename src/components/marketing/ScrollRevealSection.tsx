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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Sécurité SSR / environnements de test jsdom
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

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
  }, []);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
      }}
      className={`transform transition-all duration-700 ease-out ${
        isVisible
          ? 'opacity-100 translate-y-0 filter-none'
          : 'opacity-0 translate-y-8 filter blur-[2px]'
      } ${className}`}
    >
      {children}
    </div>
  );
}
