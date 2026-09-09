import { MailWarning } from 'lucide-react';
import { useState } from 'react';

import { useToast } from '@/components/feedback/toast-context';
import { Button } from '@/components/ui/Button';

import { resendConfirmationEmail } from '../api/auth.api';
import { emailEstConfirme } from '../email-confirmation';
import { useAuth } from '../hooks/useAuth';

/**
 * Rappelle de confirmer son adresse — sans jamais barrer la route.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UN RAPPEL, PAS UN MUR
 *
 * L'inscription renvoyait autrefois vers la boîte mail avant de laisser entrer.
 * Ce bandeau remplace ce mur : l'utilisateur travaille immédiatement, et la
 * confirmation devient une tâche qu'il fait quand il veut — jusqu'à ce qu'il
 * cherche à inviter un collègue ou à souscrire, deux gestes qui l'exigent.
 *
 * Il n'est donc ni bloquant, ni masquable. Pas bloquant parce que rien ne
 * justifie d'empêcher quelqu'un de consulter ses propres données ; pas
 * masquable parce qu'il explique pourquoi deux boutons du produit refuseront
 * de fonctionner. Le faire disparaître d'un clic rendrait ces refus
 * incompréhensibles.
 *
 * Il disparaît de lui-même dès que l'adresse est confirmée, sans rechargement :
 * la session est mise à jour par `onAuthStateChange`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function EmailConfirmationBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  if (user === null || emailEstConfirme(user)) return null;

  const renvoyer = async () => {
    if (user.email === undefined) return;
    setEnvoiEnCours(true);
    try {
      await resendConfirmationEmail(user.email);
      toast.succes('Lien renvoyé', `Un nouveau lien vient de partir vers ${user.email}.`);
    } catch {
      /*
        Message volontairement neutre.

        Supabase limite la fréquence des renvois, et son erreur parle de
        secondes d'attente — un détail technique qui n'aide personne. Le
        conseil utile est le même dans tous les cas de figure : regarder les
        indésirables avant de redemander.
      */
      toast.erreur(
        'Envoi impossible pour l’instant',
        'Patientez une minute, et regardez vos indésirables avant de redemander.',
      );
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div
      role="status"
      className="border-warning/30 bg-warning/10 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2">
        <MailWarning className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="text-foreground text-xs leading-relaxed font-medium">
          Confirmez votre adresse <span className="font-semibold">{user.email}</span> pour pouvoir
          inviter votre équipe et souscrire une formule. Tout le reste est déjà accessible.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void renvoyer()}
        disabled={envoiEnCours}
        className="shrink-0"
      >
        {envoiEnCours ? 'Envoi…' : 'Renvoyer le lien'}
      </Button>
    </div>
  );
}
