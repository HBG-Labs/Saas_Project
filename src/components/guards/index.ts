/**
 * Gardes de routes.
 *
 * Aucun de ces composants n'assure la sécurité : ils rendent l'interface
 * honnête. Un utilisateur qui contourne un garde atteint la route, et n'y voit
 * rien — les policies RLS ne lui renvoyant aucune ligne. Ce qu'ils apportent,
 * c'est une explication à la place d'un écran vide.
 */
export { RequireOrganization } from './RequireOrganization';
export { RequirePermission, type RequirePermissionProps } from './RequirePermission';
export { RequirePlan, type RequirePlanProps } from './RequirePlan';
