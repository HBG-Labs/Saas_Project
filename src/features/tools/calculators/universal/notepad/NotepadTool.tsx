import { NotepadCard } from '@/components/notes/NotepadCard';
import { useAuth } from '@/features/auth';

export default function NotepadTool() {
  const { user } = useAuth();

  return (
    <div className="w-full">
      <NotepadCard userId={user?.id} />
    </div>
  );
}
