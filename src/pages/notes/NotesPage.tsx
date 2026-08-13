import { PageHeader } from '@/components/layout/PageHeader';
import { NotepadCard } from '@/components/notes/NotepadCard';
import { useAuth } from '@/features/auth';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function NotesPage() {
  useDocumentTitle('Bloc-notes');
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bloc-notes"
        description="Votre espace de prise de notes privé pour consigner vos réflexions, mémos et tâches personnelles."
      />

      <NotepadCard userId={user?.id} />
    </div>
  );
}
