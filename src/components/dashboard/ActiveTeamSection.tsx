import { ArrowRight, Plus, Users } from 'lucide-react';
import { Link } from 'react-router';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { useLabel } from '@/features/industries';
import { memberDisplayName } from '@/features/organizations';
import type { MemberWithProfile } from '@/types/domain';

export function ActiveTeamSection({
  members = [],
}: {
  members?: MemberWithProfile[];
}) {
  const workerPlural = useLabel('worker', true);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-3.5">
        <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4.5 text-primary" />
          {workerPlural} & Équipe
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="text-xs">
          <Link to={ROUTES.organizationMembers} className="flex items-center gap-1">
            Gérer
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="pt-4">
        {members.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <Users className="size-8 text-subtle-foreground/60 mx-auto" />
            <p className="text-xs font-medium text-muted-foreground">Aucun membre enregistré</p>
            <p className="text-2xs text-subtle-foreground">
              Invitez des collaborateurs pour leur attribuer des {workerPlural.toLowerCase()}.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link to={ROUTES.organizationMembers}>
                <Plus className="size-3.5 mr-1" /> Inviter un collaborateur
              </Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border space-y-2">
            {members.slice(0, 5).map((m) => {
              const name = memberDisplayName(m);
              const roleLabel =
                m.role === 'owner'
                  ? 'Direction'
                  : m.role === 'admin'
                    ? 'Administrateur'
                    : m.role === 'manager'
                      ? 'Responsable'
                      : 'Technicien';

              return (
                <div key={m.id} className="flex items-center justify-between gap-3 pt-2 first:pt-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{name}</p>
                      <p className="text-2xs text-muted-foreground capitalize">{roleLabel}</p>
                    </div>
                  </div>

                  <Badge
                    variant={m.status === 'active' ? 'success' : 'outline'}
                    className="text-2xs shrink-0"
                  >
                    {m.status === 'active' ? 'Actif' : 'Invité'}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
