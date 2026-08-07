import { useParams } from 'react-router';

import { PagePlaceholder } from '@/components/feedback/PagePlaceholder';

export default function CategoryPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>();

  return (
    <PagePlaceholder
      title={`Catégorie : ${categorySlug ?? 'inconnue'}`}
      description="Listera les outils de la catégorie, en croisant la table `categories` et le registry."
      plannedFor="Phase 3"
    />
  );
}
