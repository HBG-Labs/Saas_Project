import { useState } from 'react';
import {
  Wrench,
  Search,
  Filter,
  Plus,
  ShieldCheck,
  AlertTriangle,
  Clock,
  User,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  HardHat,
  Cpu,
  Trash2,
  Pencil,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useDocumentTitle } from '@/lib/use-document-title';

export interface EquipmentItem {
  id: string;
  name: string;
  category: 'optique' | 'electricite' | 'radio' | 'securite';
  serialNumber: string;
  brand: string;
  assignedTo: string | null;
  status: 'available' | 'assigned' | 'maintenance' | 'expired';
  lastCalibration: string;
  nextCalibration: string;
  condition: 'Neuf' | 'Bon état' | 'À réviser';
}

const INITIAL_EQUIPMENT: EquipmentItem[] = [
  {
    id: 'eq-101',
    name: 'Réflectomètre OTDR SmartOTDR',
    category: 'optique',
    serialNumber: 'OTDR-972-88',
    brand: 'VIAVI Solutions',
    assignedTo: 'Stéphane Leduc',
    status: 'assigned',
    lastCalibration: '2025-11-10',
    nextCalibration: '2026-11-10',
    condition: 'Bon état',
  },
  {
    id: 'eq-102',
    name: 'Soudeuse Fibre Optique 70S+',
    category: 'optique',
    serialNumber: 'FJ-70S-410',
    brand: 'Fujikura',
    assignedTo: 'Stéphane Leduc',
    status: 'assigned',
    lastCalibration: '2026-01-15',
    nextCalibration: '2027-01-15',
    condition: 'Neuf',
  },
  {
    id: 'eq-103',
    name: 'Pince Ampèremétrique Fluke 376 FC',
    category: 'electricite',
    serialNumber: 'FLK-376-90',
    brand: 'Fluke',
    assignedTo: 'Mathieu Laurent',
    status: 'assigned',
    lastCalibration: '2025-06-20',
    nextCalibration: '2026-06-20',
    condition: 'Bon état',
  },
  {
    id: 'eq-104',
    name: 'Analyseur de Réseau IP & Ethernet OneExpert',
    category: 'radio',
    serialNumber: 'ONX-580-12',
    brand: 'VIAVI Solutions',
    assignedTo: null,
    status: 'available',
    lastCalibration: '2026-02-01',
    nextCalibration: '2027-02-01',
    condition: 'Neuf',
  },
  {
    id: 'eq-105',
    name: 'Contrôleur d’Isolement & Continuité C.A 6117',
    category: 'electricite',
    serialNumber: 'CA-6117-99',
    brand: 'Chauvin Arnoux',
    assignedTo: null,
    status: 'maintenance',
    lastCalibration: '2024-05-10',
    nextCalibration: '2025-05-10',
    condition: 'À réviser',
  },
  {
    id: 'eq-106',
    name: 'Harnais d’Antichute & Ligne de Vie Pylône',
    category: 'securite',
    serialNumber: 'PETZL-H-44',
    brand: 'Petzl',
    assignedTo: 'Stéphane Leduc',
    status: 'assigned',
    lastCalibration: '2025-09-01',
    nextCalibration: '2026-09-01',
    condition: 'Bon état',
  },
];

export default function EquipmentPage() {
  useDocumentTitle('Parc Matériel & Outillage');

  const [equipments, setEquipments] = useState<EquipmentItem[]>(() => {
    try {
      const saved = localStorage.getItem('nexoratech_equipment_fleet');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_EQUIPMENT;
  });

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modale création d'équipement
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEq, setNewEq] = useState({
    name: '',
    brand: '',
    serialNumber: '',
    category: 'optique' as EquipmentItem['category'],
    status: 'assigned' as EquipmentItem['status'],
    assignedTo: '',
    nextCalibration: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
  });

  const saveEquipments = (newList: EquipmentItem[]) => {
    setEquipments(newList);
    try {
      localStorage.setItem('nexoratech_equipment_fleet', JSON.stringify(newList));
    } catch {
      // Ignore
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEq.name.trim()) return;

    const assignedName = newEq.assignedTo.trim();

    const created: EquipmentItem = {
      id: `eq-${Date.now()}`,
      name: newEq.name.trim(),
      brand: newEq.brand.trim() || 'Générique',
      serialNumber: newEq.serialNumber.trim() || `SN-${Math.floor(Math.random() * 10000)}`,
      category: newEq.category,
      assignedTo: assignedName || null,
      status: assignedName ? 'assigned' : newEq.status,
      lastCalibration: new Date().toISOString().split('T')[0],
      nextCalibration: newEq.nextCalibration || 'Non spécifié',
      condition: 'Neuf',
    };

    saveEquipments([created, ...equipments]);
    setIsAddOpen(false);
    setNewEq({
      name: '',
      brand: '',
      serialNumber: '',
      category: 'optique',
      status: 'assigned',
      assignedTo: '',
      nextCalibration: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
    });
  };

  const handleDelete = (id: string) => {
    saveEquipments(equipments.filter((e) => e.id !== id));
  };

  // Filtrage
  const filtered = equipments.filter((eq) => {
    const matchesSearch =
      eq.name.toLowerCase().includes(search.toLowerCase()) ||
      eq.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      eq.brand.toLowerCase().includes(search.toLowerCase()) ||
      (eq.assignedTo && eq.assignedTo.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = filterCategory === 'all' || eq.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || eq.status === filterStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // KPi Stats
  const totalCount = equipments.length;
  const assignedCount = equipments.filter((e) => e.status === 'assigned').length;
  const availableCount = equipments.filter((e) => e.status === 'available').length;
  const maintenanceCount = equipments.filter((e) => e.status === 'maintenance' || e.status === 'expired').length;

  const [editingEquipment, setEditingEquipment] = useState<EquipmentItem | null>(null);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEquipment) return;

    const updatedStatus = editingEquipment.assignedTo && editingEquipment.assignedTo.trim() !== ''
      ? 'assigned'
      : editingEquipment.status === 'assigned'
      ? 'available'
      : editingEquipment.status;

    const updatedList = equipments.map((eq) =>
      eq.id === editingEquipment.id ? { ...editingEquipment, status: updatedStatus } : eq,
    );

    saveEquipments(updatedList);
    setEditingEquipment(null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader
        title="Parc Matériel & Outillage"
        description="Inventaire en direct des appareils de mesure, soudeuses optiques, outils électriques et état d'étalonnage."
      />

      {/* KPI Cards Header */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-500/20 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Total Équipements</p>
              <p className="mt-1 text-2xl font-bold text-white">{totalCount}</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Cpu className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="border-emerald-500/20 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-emerald-400">Attribués / Sur le terrain</p>
              <p className="mt-1 text-2xl font-bold text-white">{assignedCount}</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <User className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="border-slate-700 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-slate-300">Disponibles en Stock</p>
              <p className="mt-1 text-2xl font-bold text-white">{availableCount}</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="border-amber-500/20 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-amber-400">Étalonnage / Révision</p>
              <p className="mt-1 text-2xl font-bold text-white">{maintenanceCount}</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="size-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Barre d'action et filtres */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, marque, matricule S/N ou technicien..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900/80 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900 py-2 px-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Toutes catégories</option>
              <option value="optique">Optique & Fibre</option>
              <option value="electricite">Électricité BT/HTA</option>
              <option value="radio">Réseaux & Radio</option>
              <option value="securite">Sécurité & EPI</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900 py-2 px-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="assigned">Attribué</option>
              <option value="available">Disponible</option>
              <option value="maintenance">En révision</option>
            </select>

            <Button
              variant="primary"
              onClick={() => setIsAddOpen(true)}
              className="cursor-pointer gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs"
            >
              <Plus className="size-4" />
              Nouveau matériel
            </Button>
          </div>
        </div>
      </Card>

      {/* Liste du Parc Matériel */}
      <div className="space-y-3">
        {filtered.map((eq) => {
          const categoryLabels: Record<string, string> = {
            optique: 'Optique & Fibre',
            electricite: 'Électricité BT',
            radio: 'Réseaux & IT',
            securite: 'Sécurité & EPI',
          };

          const statusBadge =
            eq.status === 'assigned' ? (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-2xs">
                Attribué · {eq.assignedTo}
              </Badge>
            ) : eq.status === 'available' ? (
              <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 text-2xs">
                Stock Disponible
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-2xs">
                En Révision / Étalonnage
              </Badge>
            );

          return (
            <Card key={eq.id} className="p-4 hover:border-slate-700 transition-colors">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-blue-400 border border-slate-700 mt-0.5">
                    <Wrench className="size-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-sm font-semibold text-white">{eq.name}</h3>
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-2xs text-slate-300">
                        {eq.brand}
                      </span>
                      {statusBadge}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                      <span>Matricule S/N : <strong className="text-slate-200 font-mono">{eq.serialNumber}</strong></span>
                      <span>•</span>
                      <span>Catégorie : <strong className="text-slate-300">{categoryLabels[eq.category] || eq.category}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Calendar className="size-3 text-slate-400" /> Prochain étalonnage : <strong className="text-slate-300">{eq.nextCalibration}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditingEquipment(eq)}
                    className="cursor-pointer text-slate-400 hover:text-blue-400"
                    title="Modifier cet équipement"
                  >
                    <Pencil className="size-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(eq.id)}
                    className="cursor-pointer text-slate-400 hover:text-rose-400"
                    title="Supprimer"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card className="p-8 text-center text-slate-400">
            <p className="text-sm">Aucun équipement ne correspond à votre recherche.</p>
          </Card>
        )}
      </div>

      {/* Modal d'ajout de matériel */}
      <Modal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title="Ajouter un équipement au parc"
        description="Enregistrez un nouvel appareil de mesure, réflectomètre ou outil professionnel."
      >
        <form onSubmit={handleAddSubmit} className="space-y-4 pt-2">
          <Input
            label="Nom de l'équipement"
            placeholder="ex: Soudeuse Optique Fujikura 90S"
            value={newEq.name}
            onChange={(e) => setNewEq({ ...newEq, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Marque / Constructeur"
              placeholder="ex: VIAVI, Fujikura, Fluke"
              value={newEq.brand}
              onChange={(e) => setNewEq({ ...newEq, brand: e.target.value })}
            />
            <Input
              label="Matricule / Numéro de Série (S/N)"
              placeholder="ex: SN-98204"
              value={newEq.serialNumber}
              onChange={(e) => setNewEq({ ...newEq, serialNumber: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">Catégorie technique</label>
              <select
                value={newEq.category}
                onChange={(e) => setNewEq({ ...newEq, category: e.target.value as EquipmentItem['category'] })}
                className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 px-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="optique">Optique & Fibre FTTH</option>
                <option value="electricite">Électricité BT / HTA</option>
                <option value="radio">Réseaux IP & Radio</option>
                <option value="securite">Sécurité & EPI</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">Statut du matériel</label>
              <select
                value={newEq.status}
                onChange={(e) => setNewEq({ ...newEq, status: e.target.value as EquipmentItem['status'] })}
                className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 px-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="assigned">Attribué à un technicien</option>
                <option value="available">Disponible en Stock</option>
                <option value="maintenance">En Révision / Étalonnage</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Affecter à un technicien (Facultatif)"
              placeholder="ex: Stéphane Leduc"
              value={newEq.assignedTo ?? ''}
              onChange={(e) => setNewEq({ ...newEq, assignedTo: e.target.value })}
            />
            <Input
              label="Date du prochain étalonnage (Facultatif)"
              type="date"
              value={newEq.nextCalibration}
              onChange={(e) => setNewEq({ ...newEq, nextCalibration: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)} className="cursor-pointer">
              Annuler
            </Button>
            <Button type="submit" variant="primary" className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white">
              Enregistrer l'équipement
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal d'édition d'équipement */}
      {editingEquipment && (
        <Modal
          open={Boolean(editingEquipment)}
          onOpenChange={(open) => {
            if (!open) setEditingEquipment(null);
          }}
          title="Modifier l'équipement"
          description="Mettez à jour le nom, le matricule S/N, le statut ou la date du prochain étalonnage."
        >
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <Input
              label="Nom de l'équipement *"
              value={editingEquipment.name}
              onChange={(e) => setEditingEquipment({ ...editingEquipment, name: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Marque / Constructeur"
                value={editingEquipment.brand}
                onChange={(e) => setEditingEquipment({ ...editingEquipment, brand: e.target.value })}
              />
              <Input
                label="Matricule S/N"
                value={editingEquipment.serialNumber}
                onChange={(e) => setEditingEquipment({ ...editingEquipment, serialNumber: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Catégorie technique</label>
                <select
                  value={editingEquipment.category}
                  onChange={(e) =>
                    setEditingEquipment({
                      ...editingEquipment,
                      category: e.target.value as EquipmentItem['category'],
                    })
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 px-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                >
                  <option value="optique">Optique & Fibre FTTH</option>
                  <option value="electricite">Électricité BT / HTA</option>
                  <option value="radio">Réseaux IP & Radio</option>
                  <option value="securite">Sécurité & EPI</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Statut du matériel</label>
                <select
                  value={editingEquipment.status}
                  onChange={(e) =>
                    setEditingEquipment({
                      ...editingEquipment,
                      status: e.target.value as EquipmentItem['status'],
                    })
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 px-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                >
                  <option value="assigned">Attribué à un technicien</option>
                  <option value="available">Disponible en Stock</option>
                  <option value="maintenance">En Révision / Étalonnage</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Attribué au technicien"
                placeholder="ex: Stéphane Leduc"
                value={editingEquipment.assignedTo ?? ''}
                onChange={(e) => setEditingEquipment({ ...editingEquipment, assignedTo: e.target.value })}
              />
              <Input
                label="Date du prochain étalonnage"
                type="date"
                value={editingEquipment.nextCalibration}
                onChange={(e) => setEditingEquipment({ ...editingEquipment, nextCalibration: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditingEquipment(null)}
                className="cursor-pointer"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-semibold"
              >
                Enregistrer les modifications
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
