import archives from '@/assets/illustrations/archives.svg';
import audit from '@/assets/illustrations/audit.svg';
import customers from '@/assets/illustrations/customers.svg';
import equipment from '@/assets/illustrations/equipment.svg';
import favorites from '@/assets/illustrations/favorites.svg';
import history from '@/assets/illustrations/history.svg';
import invitations from '@/assets/illustrations/invitations.svg';
import library from '@/assets/illustrations/library.svg';
import invoices from '@/assets/illustrations/invoices.svg';
import messages from '@/assets/illustrations/messages.svg';
import missions from '@/assets/illustrations/missions.svg';
import notes from '@/assets/illustrations/notes.svg';
import pages from '@/assets/illustrations/pages.svg';
import purchases from '@/assets/illustrations/purchases.svg';
import quotes from '@/assets/illustrations/quotes.svg';
import reports from '@/assets/illustrations/reports.svg';
import stock from '@/assets/illustrations/stock.svg';
import teams from '@/assets/illustrations/teams.svg';
import technicians from '@/assets/illustrations/technicians.svg';
import vehicles from '@/assets/illustrations/vehicles.svg';
import { cn } from '@/lib/cn';

const illustrations = {
  archives,
  audit,
  customers,
  equipment,
  favorites,
  history,
  invitations,
  invoices,
  library,
  messages,
  missions,
  notes,
  pages,
  purchases,
  quotes,
  reports,
  stock,
  teams,
  technicians,
  vehicles,
};

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
      data-atelier-illustration={subject}
      className={cn(
        'atelier-illustration relative isolate block w-44 max-w-full shrink-0 sm:w-64',
        className,
      )}
    >
      <span
        data-atelier-orbit="true"
        className="border-primary/20 absolute inset-x-5 inset-y-8 -z-10 rotate-12 rounded-full border"
      />
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
