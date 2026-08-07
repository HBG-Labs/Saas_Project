import { useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/features/auth';
import { formatDate } from '@/lib/format';

export default function ProfilePage() {
  const { user } = useAuth();

  const currentName =
    (user?.user_metadata['display_name'] as string | undefined) ?? user?.email?.split('@')[0] ?? '';

  const [displayName, setDisplayName] = useState(currentName);
  const isDirty = displayName.trim() !== currentName && displayName.trim() !== '';

  return (
    <>
      <PageHeader title="Profil" description="Vos informations personnelles." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informations</CardTitle>
            <CardDescription>Ces informations apparaissent dans l’application.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={currentName || 'Utilisateur'} size="lg" />
              <div>
                <p className="text-sm font-medium">{currentName || 'Utilisateur'}</p>
                <p className="text-muted-foreground text-xs">
                  L’avatar est généré à partir de vos initiales.
                </p>
              </div>
            </div>

            <Input
              label="Nom affiché"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
              }}
              maxLength={60}
            />

            <Input
              label="Adresse e-mail"
              type="email"
              value={user?.email ?? ''}
              readOnly
              disabled
              hint="La modification de l’adresse e-mail sera disponible ultérieurement."
            />

            {/* Le bouton reste désactivé tant que rien n'a changé : proposer une
                action sans effet est une source de confusion. */}
            <Button disabled={!isDirty}>Enregistrer les modifications</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-subtle-foreground text-xs">Membre depuis</p>
              <p className="mt-0.5 font-medium">
                {user?.created_at ? formatDate(user.created_at) : '—'}
              </p>
            </div>
            <div>
              <p className="text-subtle-foreground text-xs">Identifiant</p>
              <p className="mt-0.5 font-mono text-xs break-all">{user?.id ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
