import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type {
  EquipmentCategory,
  EquipmentCondition,
  EquipmentStatus,
  TablesInsert,
  TablesUpdate,
} from '@/types/database';
import type { Equipment, EquipmentWithAssignee } from '@/types/domain';

/**
 * Accès au parc matériel.
 *
 * Seul endroit de la feature autorisé à parler à Supabase. Les policies
 * `equipment_*` réservent la lecture à `equipment.view` et l'écriture à
 * `equipment.manage`, toutes deux conditionnées par
 * `app.can_use_pro_module(organization_id, 'equipment')`.
 *
 * Le statut « affecté » et le membre affecté sont liés par une contrainte CHECK :
 * l'un ne va pas sans l'autre. Les fonctions ci-dessous respectent cette
 * cohérence plutôt que de laisser la base la refuser après coup.
 */

/** Jointure commune : l'appareil et la personne à qui il est confié. */
const EQUIPMENT_SELECT = `
  *,
  assigned_member:organization_members(
    *, profile:profiles(id, display_name, avatar_url)
  )
` as const;

export interface EquipmentFilters {
  search?: string;
  status?: EquipmentStatus;
  category?: EquipmentCategory;
  /** Classement par metier. Remplace `category`, tenu en phase par trigger. */
  categoryId?: string;
}

export async function listEquipment(
  organizationId: string,
  filters: EquipmentFilters = {},
): Promise<EquipmentWithAssignee[]> {
  let query = supabase
    .from('equipment')
    .select(EQUIPMENT_SELECT)
    .eq('organization_id', organizationId);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);

  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, ' ').trim();
    if (term !== '') {
      query = query.or(`name.ilike.%${term}%,brand.ilike.%${term}%,serial_number.ilike.%${term}%`);
    }
  }

  return unwrap(
    query.order('name', { ascending: true }).returns<EquipmentWithAssignee[]>(),
  );
}

export async function getEquipment(equipmentId: string): Promise<EquipmentWithAssignee | null> {
  return unwrapMaybe(
    supabase
      .from('equipment')
      .select(EQUIPMENT_SELECT)
      .eq('id', equipmentId)
      .single()
      .returns<EquipmentWithAssignee>(),
  );
}

export interface EquipmentInput {
  organizationId: string;
  name: string;
  brand?: string;
  serialNumber?: string;
  category?: EquipmentCategory;
  /** Classement par metier. Le trigger `equipment_sync_category` aligne l'enum. */
  categoryId?: string;
  condition?: EquipmentCondition;
  assignedMemberId?: string | null;
  lastCalibration?: string | null;
  nextCalibration?: string | null;
  notes?: string;
}

/**
 * Le statut découle de l'affectation, il ne se déclare pas.
 *
 * Un appareil confié à quelqu'un est `assigned` ; rendu, il redevient
 * `available` — sauf s'il part en révision, décision qui appartient à
 * l'utilisateur et que l'on ne devine pas.
 */
function resolveStatus(
  assignedMemberId: string | null | undefined,
  current?: EquipmentStatus,
): EquipmentStatus {
  if (assignedMemberId) return 'assigned';
  if (current === 'maintenance' || current === 'expired') return current;
  return 'available';
}

export async function createEquipment(input: EquipmentInput): Promise<Equipment> {
  const { data: userData } = await supabase.auth.getUser();

  const payload: TablesInsert<'equipment'> = {
    organization_id: input.organizationId,
    name: input.name,
    status: resolveStatus(input.assignedMemberId),
    ...(userData?.user ? { created_by: userData.user.id } : {}),
    ...(input.brand !== undefined ? { brand: input.brand } : {}),
    ...(input.serialNumber !== undefined ? { serial_number: input.serialNumber } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
    ...(input.condition !== undefined ? { condition: input.condition } : {}),
    ...(input.assignedMemberId ? { assigned_member_id: input.assignedMemberId } : {}),
    ...(input.lastCalibration !== undefined ? { last_calibration: input.lastCalibration } : {}),
    ...(input.nextCalibration !== undefined ? { next_calibration: input.nextCalibration } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };

  return unwrap(supabase.from('equipment').insert(payload).select('*').single());
}

export async function updateEquipment(
  equipmentId: string,
  patch: TablesUpdate<'equipment'>,
): Promise<Equipment> {
  // La contrainte `equipment_assignment_coherent` refuserait un statut
  // `assigned` sans membre. On aligne donc le statut dès que l'affectation
  // change, plutôt que de laisser remonter une erreur de contrainte.
  const aligned: TablesUpdate<'equipment'> =
    'assigned_member_id' in patch
      ? { ...patch, status: resolveStatus(patch.assigned_member_id, patch.status) }
      : patch;

  return unwrap(
    supabase.from('equipment').update(aligned).eq('id', equipmentId).select('*').single(),
  );
}

export async function deleteEquipment(equipmentId: string): Promise<void> {
  const { error } = await supabase.from('equipment').delete().eq('id', equipmentId);
  if (error) throw error;
}
