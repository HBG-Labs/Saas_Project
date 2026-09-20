import library from '@/assets/illustrations/library.svg';
import notes from '@/assets/illustrations/notes.svg';
import pages from '@/assets/illustrations/pages.svg';
import { cn } from '@/lib/cn';

const illustrations = { library, notes, pages };

/** Décor de premier usage : le texte adjacent porte le sens et l'action. */
export function AtelierIllustration({
  subject,
  className,
}: {
  subject: keyof typeof illustrations;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'atelier-illustration relative isolate block w-56 max-w-full shrink-0 sm:w-64',
        className,
      )}
    >
      <span className="bg-surface-sunken absolute inset-x-8 inset-y-5 -z-10 rounded-full" />
      <span className="border-border absolute inset-x-5 inset-y-8 -z-10 rotate-12 rounded-full border" />
      <img
        src={illustrations[subject]}
        alt=""
        width={360}
        height={280}
        className="block h-auto w-full"
        decoding="async"
      />
    </span>
  );
}
