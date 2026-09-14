import { Check, Lock, LogOut, Shield } from 'lucide-react';
import { useState } from 'react';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { signOutOtherDevices, useAuth } from '@/features/auth';

export function SecuritySettingsTab({ onSaved }: { onSaved?: () => void }) {
  const { user } = useAuth();
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);
  const [othersSignedOut, setOthersSignedOut] = useState(false);
  const [signOutError, setSignOutError] = useState<unknown>(null);

  const lastSignInLabel =
    user?.last_sign_in_at == null
      ? null
      : new Date(user.last_sign_in_at).toLocaleString('fr-FR', {
          dateStyle: 'long',
          timeStyle: 'short',
        });

  const handleSignOutOthers = async () => {
    setIsSigningOutOthers(true);
    setSignOutError(null);
    setOthersSignedOut(false);
    try {
      await signOutOtherDevices();
      setOthersSignedOut(true);
      onSaved?.();
    } catch (error) {
      setSignOutError(error);
    } finally {
      setIsSigningOutOthers(false);
    }
  };

  return (
    <div className="animate-in fade-in space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 border-b">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Shield className="size-4" />
            </span>
            <div className="space-y-1">
              <CardTitle>Sécurité & sessions actives</CardTitle>
              <CardDescription>
                Gérez vos accès de connexion et la sécurité de votre compte utilisateur.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 sm:pt-5">
          <div className="border-border bg-surface-raised flex items-start gap-3 rounded-xl border p-3">
            <span className="bg-success/10 text-success flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Lock className="size-4" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <h4 className="text-foreground text-sm font-semibold">Session actuelle</h4>
              </div>
              <p className="text-muted-foreground text-xs break-all">
                Connecté avec : <strong className="text-foreground">{user?.email}</strong>
              </p>
              {lastSignInLabel && (
                <p className="text-muted-foreground text-xs">
                  Dernière connexion : <span className="font-mono">{lastSignInLabel}</span>
                </p>
              )}
            </div>
          </div>

          <div className="border-border bg-surface-raised space-y-3 rounded-xl border p-3">
            <div>
              <h4 className="text-foreground text-sm font-semibold">
                Déconnecter les autres appareils
              </h4>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Si vous avez utilisé un terminal partagé sur chantier ou un ordinateur tiers,
                révoquez immédiatement toutes les autres sessions ouvertes.
              </p>
            </div>

            <FormError error={signOutError} />

            {othersSignedOut && (
              <div
                className="animate-in fade-in border-success/20 bg-success/10 text-success flex items-center gap-1.5 rounded-lg border p-2 text-xs font-semibold"
                role="status"
              >
                <Check className="size-3.5" />
                <span>Toutes les autres sessions ont été révoquées avec succès.</span>
              </div>
            )}

            <Button
              type="button"
              variant="danger-outline"
              size="sm"
              isLoading={isSigningOutOthers}
              loadingLabel="Déconnexion des autres appareils"
              onClick={handleSignOutOthers}
              leadingIcon={<LogOut />}
              className="w-full sm:w-auto"
            >
              <span>
                {isSigningOutOthers
                  ? 'Révocation en cours…'
                  : 'Déconnecter tous les autres appareils'}
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
