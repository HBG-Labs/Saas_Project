import { useState } from 'react';
import {
  Check,
  X,
  Palmtree,
  Plus,
  CheckCircle2,
  Hourglass,
  Calendar,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth';
import { usePermission } from '@/features/organizations';
import { cn } from '@/lib/cn';
import type { LeaveRequest, StaffLeaveBalance, LeaveStatus } from '../types';

interface LeavesManagementTabProps {
  leaves: LeaveRequest[];
  balances: StaffLeaveBalance[];
  /**
   * Masque les boutons de décision pour qui n'a pas `leave.approve`.
   *
   * Cela ne SÉCURISE rien : le trigger `enforce_leave_decision` refuse de toute
   * façon. Mais afficher « Valider le congé » à un technicien lui promettrait
   * une action que le serveur lui refusera — un menu doit décrire le travail de
   * qui le regarde, pas le produit.
   */
  canApprove: boolean;
  onOpenNewLeave: () => void;
  onUpdateStatus: (leaveId: string, status: LeaveStatus) => void;
}

export function LeavesManagementTab({
  leaves,
  balances,
  canApprove,
  onOpenNewLeave,
  onUpdateStatus,
}: LeavesManagementTabProps) {
  const { user } = useAuth();
  const { role } = usePermission();
  const isOwner = role === 'owner';
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const pendingLeaves = leaves.filter((l) => l.status === 'pending');
  const approvedLeaves = leaves.filter((l) => l.status === 'approved');
  const rejectedLeaves = leaves.filter((l) => l.status === 'rejected');
  const cancelledLeaves = leaves.filter((l) => l.status === 'cancelled');

  const filteredLeaves = leaves.filter((l) => {
    if (filterStatus === 'all') return true;
    return l.status === filterStatus;
  });

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case 'paid_leave':
        return { label: 'Congés Payés (CP)', variant: 'warning' as const };
      case 'rtt':
        return { label: 'RTT', variant: 'primary' as const };
      case 'recovery':
        return { label: 'Récupération', variant: 'accent' as const };
      case 'sick_leave':
        return { label: 'Arrêt Maladie', variant: 'error' as const };
      case 'family':
        return { label: 'Événement Familial', variant: 'neutral' as const };
      default:
        return { label: 'Congé sans solde', variant: 'outline' as const };
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Leave KPI Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-surface border border-border flex items-center justify-between shadow-xs">
          <div>
            <p className="text-3xs text-muted-foreground uppercase font-bold tracking-wider">
              En attente d'approbation
            </p>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
              {pendingLeaves.length}
            </p>
          </div>
          <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Hourglass className="size-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-border flex items-center justify-between shadow-xs">
          <div>
            <p className="text-3xs text-muted-foreground uppercase font-bold tracking-wider">
              Congés validés ce mois
            </p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {approvedLeaves.length}
            </p>
          </div>
          <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <CheckCircle2 className="size-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-border flex items-center justify-between shadow-xs">
          <div>
            <p className="text-3xs text-muted-foreground uppercase font-bold tracking-wider">
              Total jours posés (Août)
            </p>
            <p className="text-2xl font-extrabold text-primary mt-0.5">
              {approvedLeaves.reduce((acc, l) => acc + l.daysCount, 0)} j
            </p>
          </div>
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <Calendar className="size-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-border flex items-center justify-between shadow-xs">
          <div>
            <p className="text-3xs text-muted-foreground uppercase font-bold tracking-wider">
              Effectif Disponible
            </p>
            <p className="text-2xl font-extrabold text-foreground mt-0.5">3 / 4</p>
          </div>
          <div className="size-10 rounded-xl bg-surface-subtle text-foreground flex items-center justify-center border border-border">
            <Palmtree className="size-5 text-primary" />
          </div>
        </div>
      </div>

      {/* 2. Tableau des Soldes de Congés & RTT du Personnel */}
      <div className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface-subtle/40">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">Soldes de Congés du Personnel</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Suivi des droits acquis et des jours restants par technicien
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={onOpenNewLeave} className="text-xs h-8 gap-1">
            <Plus className="size-3.5" />
            <span>Poser une absence</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {balances.map((staff) => (
            <div key={staff.technicianId} className="p-4 space-y-3 hover:bg-surface-hover/30 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20">
                  {staff.technicianInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-foreground truncate">{staff.technicianName}</h4>
                  <p className="text-3xs text-muted-foreground truncate">{staff.technicianRole}</p>
                </div>
              </div>

              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-3xs">Congés Payés (CP) :</span>
                  <span className="font-bold text-foreground">{staff.paidLeaveRemaining} j</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-3xs">Solde RTT :</span>
                  <span className="font-bold text-primary">{staff.rttRemaining} j</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-3xs">Heures Récupération :</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {staff.recoveryHours}h
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. File des Demandes d'Absences & Validation */}
      <div className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden">
        {/* Header & Filter Tabs */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-subtle/30">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">
              Demandes & Historique des Absences
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Validez ou refusez les demandes de congés déposées
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-surface-subtle p-1 rounded-xl border border-border self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-lg transition-all',
                filterStatus === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Toutes ({leaves.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('pending')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1',
                filterStatus === 'pending'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              En attente ({pendingLeaves.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('approved')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-lg transition-all',
                filterStatus === 'approved'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Validées ({approvedLeaves.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('rejected')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-lg transition-all',
                filterStatus === 'rejected'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Refusées ({rejectedLeaves.length})
            </button>
            {cancelledLeaves.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterStatus('cancelled')}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-lg transition-all',
                  filterStatus === 'cancelled'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Annulées ({cancelledLeaves.length})
              </button>
            )}
          </div>
        </div>

        {/* Requests List */}
        <div className="divide-y divide-border">
          {filteredLeaves.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Aucune demande d'absence dans cette catégorie.
            </div>
          ) : (
            filteredLeaves.map((leave) => {
              const typeInfo = getLeaveTypeLabel(leave.type);
              const isPending = leave.status === 'pending';
              const isSelf = Boolean(leave.userId && user?.id && leave.userId === user.id);

              return (
                <div
                  key={leave.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-hover/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20 shrink-0 mt-0.5">
                      {leave.technicianInitials}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-foreground">{leave.technicianName}</h4>
                        <Badge variant={typeInfo.variant} className="text-3xs font-semibold">
                          {typeInfo.label}
                        </Badge>
                        <Badge
                          variant={
                            leave.status === 'approved'
                              ? 'success'
                              : leave.status === 'rejected'
                                ? 'error'
                                : leave.status === 'cancelled'
                                  ? 'outline'
                                  : 'warning'
                          }
                          className="text-3xs"
                        >
                          {leave.status === 'approved'
                            ? 'Validé'
                            : leave.status === 'rejected'
                              ? 'Refusé'
                              : leave.status === 'cancelled'
                                ? 'Annulé'
                                : 'En attente'}
                        </Badge>
                      </div>

                      <p className="text-xs font-semibold text-foreground">
                        Du <span className="font-bold text-primary">{leave.startDate}</span> au{' '}
                        <span className="font-bold text-primary">{leave.endDate}</span> (
                        {leave.daysCount} jour{leave.daysCount > 1 ? 's' : ''})
                      </p>

                      <p className="text-3xs text-muted-foreground">Motif : {leave.reason}</p>

                      {leave.approvedBy && (
                        <p className="text-3xs text-muted-foreground/80">
                          Approuvé par {leave.approvedBy} le {leave.approvedAt}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions for Pending & Processed Requests */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isPending ? (
                      canApprove && (isOwner || !isSelf) ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onUpdateStatus(leave.id, 'rejected')}
                            className="text-xs h-8 px-2.5 gap-1 border-rose-500/30 text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <X className="size-3.5" />
                            Refuser
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => onUpdateStatus(leave.id, 'approved')}
                            className="text-xs h-8 px-3 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                          >
                            <Check className="size-3.5" />
                            Valider le congé
                          </Button>
                        </>
                      ) : isSelf ? (
                        <div className="flex items-center gap-2">
                          <span className="text-3xs text-muted-foreground font-medium italic bg-surface-sunken px-2.5 py-1 rounded-md border border-border">
                            Votre demande (en attente)
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onUpdateStatus(leave.id, 'rejected')}
                            className="text-xs h-7 px-2 border-rose-500/30 text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                            title="Annuler ma demande de congé"
                          >
                            <X className="size-3 mr-1" />
                            Annuler
                          </Button>
                        </div>
                      ) : (
                        <span className="text-3xs text-muted-foreground font-mono">
                          En attente de validation
                        </span>
                      )
                    ) : isOwner ? (
                      leave.status === 'approved' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onUpdateStatus(leave.id, 'cancelled')}
                          className="text-xs h-7 px-2.5 gap-1 border-rose-500/30 text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                          title="Révoquer ce congé et libérer le planning"
                        >
                          <X className="size-3" />
                          Révoquer le congé
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onUpdateStatus(leave.id, 'approved')}
                          className="text-xs h-7 px-2.5 gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                          title="Réexaminer et valider ce congé"
                        >
                          <Check className="size-3" />
                          Valider le congé
                        </Button>
                      )
                    ) : (
                      <span className="text-3xs text-muted-foreground font-mono">
                        Demande traitée
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
