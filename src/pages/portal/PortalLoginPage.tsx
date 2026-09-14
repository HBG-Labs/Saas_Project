import {
  ArrowLeft,
  FileText,
  KeyRound,
  Mail,
  MessageSquare,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { FormError } from '@/components/feedback/FormError';
import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { requestAccessCode, verifyAccessCode } from '@/features/portal';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Connexion au portail : une adresse, un code reçu par e-mail.
 *
 * Aucun mot de passe. La première étape répond la même chose pour toute
 * adresse — c'est le serveur qui décide d'envoyer un code, et il ne dit pas
 * s'il l'a fait.
 */
export default function PortalLoginPage() {
  useDocumentTitle('Espace client');
  const { status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (status === 'loading') return <LoadingScreen label="Vérification de votre session…" />;
  if (status === 'authenticated') return <Navigate to={from ?? ROUTES.portal} replace />;

  const askCode = async () => {
    setPending(true);
    setError(null);
    try {
      await requestAccessCode(email.trim());
      setStep('code');
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await verifyAccessCode(email.trim(), code.trim());
      await navigate(from ?? ROUTES.portal, { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-background flex min-h-dvh flex-col lg:flex-row">
      {/*
        Panneau de marque : bandeau court sur téléphone, colonne entière sur
        écran large. Il dit à quoi sert cet espace avant même de demander
        une adresse.
      */}
      <aside className="from-primary via-primary text-primary-foreground relative overflow-hidden bg-gradient-to-br to-blue-500 px-6 py-8 lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:px-12 lg:py-14">
        <div
          className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-white/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">REZO360</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight lg:text-4xl">
            Votre espace client
          </h2>
          <p className="mt-2 max-w-md text-sm text-white/85 lg:text-base">
            Suivez vos interventions, retrouvez vos devis et factures, et échangez avec votre
            prestataire — en toute sécurité, sans mot de passe à retenir.
          </p>
        </div>
        <ul className="relative mt-6 hidden gap-3 lg:grid">
          {[
            [
              Wrench,
              'Interventions et comptes rendus',
              'Planning, rapports validés, photos partagées.',
            ],
            [FileText, 'Devis et factures', 'Montants, échéances, PDF à télécharger.'],
            [MessageSquare, 'Messagerie', 'Répondez ici ou directement depuis vos e-mails.'],
            [ShieldCheck, 'Accès sécurisé', 'Un code à usage unique, envoyé sur votre adresse.'],
          ].map(([Icon, titre, texte]) => {
            const I = Icon as typeof Wrench;
            return (
              <li
                key={titre as string}
                className="flex items-start gap-3 rounded-xl bg-white/10 p-3 ring-1 ring-white/15"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <I className="size-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{titre as string}</span>
                  <span className="block text-xs text-white/80">{texte as string}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="flex flex-1 items-start justify-center px-4 py-6 sm:py-8 lg:items-center lg:px-12">
        <Card className="w-full max-w-md rounded-2xl shadow-md">
          <CardContent className="space-y-5 p-6 sm:p-8">
            <div className="space-y-1">
              <span className="bg-primary-subtle text-primary inline-flex size-10 items-center justify-center rounded-xl">
                <KeyRound className="size-5" aria-hidden="true" />
              </span>
              <h1 className="text-foreground pt-2 text-xl font-bold">Connexion</h1>
              <p className="text-muted-foreground text-sm">
                {step === 'email'
                  ? 'Saisissez l’adresse e-mail à laquelle votre prestataire vous a ouvert l’accès.'
                  : `Si ${email.trim()} a accès à un espace client, un code à usage unique vient de lui être envoyé.`}
              </p>
            </div>

            <FormError error={error} />

            {step === 'email' ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void askCode();
                }}
              >
                <Input
                  label="Adresse e-mail"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                  }}
                />
                <Button type="submit" className="w-full" disabled={pending || email.trim() === ''}>
                  <Mail className="size-4" />
                  {pending ? 'Envoi…' : 'Recevoir un code'}
                </Button>
              </form>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void confirm();
                }}
              >
                <Input
                  label="Code reçu par e-mail"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  required
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, ''));
                  }}
                  hint="Le code expire au bout d’une heure. Pensez à vérifier vos courriers indésirables."
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={pending || code.trim().length < 6}
                >
                  <KeyRound className="size-4" />
                  {pending ? 'Vérification…' : 'Se connecter'}
                </Button>
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep('email');
                      setCode('');
                      setError(null);
                    }}
                  >
                    <ArrowLeft className="size-4" />
                    Changer d’adresse
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      void askCode();
                    }}
                  >
                    Renvoyer un code
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
