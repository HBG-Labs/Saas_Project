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
    <div className="space-y-4 animate-in fade-in">
      <Card>
        <CardHeader className="py-3 px-4 pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-1.5">
            <Shield className="size-3.5 text-primary" />
            <span>Sécurité & Sessions Actives</span>
          </CardTitle>
          <CardDescription className="text-3xs">
            Gérez vos accès de connexion et la sécurité de votre compte utilisateur.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3.5 pt-0 space-y-4">
          <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-surface border border-border">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Lock className="size-3.5 text-primary" />
                <h4 className="text-xs font-semibold text-foreground">Session actuelle</h4>
              </div>
              <p className="text-3xs text-muted-foreground">
                Connecté avec : <strong className="text-foreground">{user?.email}</strong>
              </p>
              {lastSignInLabel && (
                <p className="text-3xs text-muted-foreground">
                  Dernière connexion : <span className="font-mono">{lastSignInLabel}</span>
                </p>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface border border-border space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-foreground">
                Déconnecter les autres appareils
              </h4>
              <p className="text-3xs text-muted-foreground">
                Si vous avez utilisé un terminal partagé sur chantier ou un ordinateur tiers, révoquez immédiatement toutes les autres sessions ouvertes.
              </p>
            </div>

            <FormError error={signOutError} />

            {othersSignedOut && (
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-success/10 text-success border border-success/20 text-2xs font-semibold animate-in fade-in">
                <Check className="size-3.5" />
                <span>Toutes les autres sessions ont été révoquées avec succès.</span>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSigningOutOthers}
              onClick={handleSignOutOthers}
              className="text-xs gap-1.5 text-danger border-danger/30 hover:bg-danger/10 hover:border-danger/60 cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span>{isSigningOutOthers ? 'Révocation en cours…' : 'Déconnecter tous les autres appareils'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
