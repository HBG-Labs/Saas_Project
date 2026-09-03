/**
 * API publique de la feature « profil ».
 */

export { getMyProfile, updateMyProfile, type FullProfile } from './api/profile.api';
export { useMyProfile, useUpdateMyProfile } from './hooks';
export { useMigrateLegacyAvatar } from './useMigrateLegacyAvatar';
export {
  AVATARS,
  AVATAR_PAR_DEFAUT,
  cheminAvatar,
  estAvatarConnu,
  type AvatarCatalogue,
  type FamilleCoiffure,
} from '@/config/avatars';
export { AvatarPicker } from './components/AvatarPicker';
