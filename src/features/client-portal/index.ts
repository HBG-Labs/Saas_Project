export type {
  ClientConversation,
  ClientConversationWithContact,
  ClientMessage,
  ClientMessageAttachment,
  ClientPortalSettings,
  SendMessageInput,
  SendMessageResult,
} from './api/client-portal.api';
export { ContactPortalSwitch } from './components/ContactPortalSwitch';
export { CustomerMessagingPanel } from './components/CustomerMessagingPanel';
export { PortalSettingsCard } from './components/PortalSettingsCard';
export { SendToClientDialog, WriteToClientButton } from './components/SendToClientDialog';
export {
  useClientConversations,
  useClientMessages,
  useClientPortalAccess,
  useCloseConversation,
  useMarkConversationRead,
  useSendClientMessage,
  useSetContactPortalAccess,
  useShareAttachments,
  useShareDocument,
  useUnreadClientMessages,
  useUpdatePortalSettings,
} from './hooks/useClientPortal';
