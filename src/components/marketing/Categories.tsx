import { CategoryCard } from '@/features/tools/components/CategoryCard';
import { CATEGORY_METADATA } from '@/features/tools/catalog-metadata';

import { Section } from './Section';

export function Categories() {
  return (
    <Section
      id="categories"
      eyebrow="Catalogue"
      title="Huit domaines techniques"
      description="Le catalogue s’enrichit progressivement. L’architecture permet d’ajouter un outil sans toucher au reste de la plateforme."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORY_METADATA.map((category) => (
          <CategoryCard key={category.slug} category={category} />
        ))}
      </div>
    </Section>
  );
}
