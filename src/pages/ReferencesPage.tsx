import { BookOpen } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';

/**
 * Références techniques.
 *
 * La table dédiée n'est volontairement pas créée : sa forme dépend du type de
 * contenu (texte, tableau, abaque, fichier), qui n'est pas encore arrêté. La
 * créer maintenant garantirait de la refaire.
 */
export default function ReferencesPage() {
  return (
    <>
      <PageHeader
        title="Références techniques"
        description="Normes, abaques et documents de référence pour vos interventions."
      />

      <EmptyState
        icon={BookOpen}
        title="Bibliothèque en préparation"
        description="Codes couleur normalisés, tables d’affaiblissement, sections de câbles et abaques seront rassemblés ici."
      />
    </>
  );
}
