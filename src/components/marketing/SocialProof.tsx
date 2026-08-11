import { Activity, Webhook, Infinity as InfinityIcon, Diamond, Layers } from 'lucide-react';

const BRANDS = [
  { icon: Activity, name: 'Acrostic' },
  { icon: Webhook, name: 'Webflow' },
  { icon: InfinityIcon, name: 'Infinity' },
  { icon: Diamond, name: 'DiamondCorp' },
  { icon: Layers, name: 'Bubble' },
];

export function SocialProof() {
  return (
    <section className="relative border-b border-border/60 bg-surface-sunken/20 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-subtle-foreground mb-8">
          Utilisé et validé par des équipes d&apos;ingénierie innovantes dans le monde entier
        </p>

        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-70 transition-all duration-500 hover:opacity-100">
          {BRANDS.map((brand) => {
            const Icon = brand.icon;
            return (
              <div
                key={brand.name}
                className="flex items-center gap-2 text-lg sm:text-xl font-bold text-foreground transition-all duration-300 hover:scale-105 hover:text-primary cursor-default"
              >
                <Icon className="size-6 text-primary shrink-0" aria-hidden="true" />
                <span>{brand.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
