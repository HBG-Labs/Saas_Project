import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
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
    <div className="bg-background flex min-h-dvh items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-1">
            <p className="text-primary text-xs font-semibold tracking-wide uppercase">REZO360</p>
            <h1 className="text-foreground text-xl font-bold">Espace client</h1>
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
              <Button type="submit" className="w-full" disabled={pending || code.trim().length < 6}>
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
  );
}
