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
export { DocumentShareDialog } from './components/DocumentShareDialog';
export { LinkCustomerControl } from './components/LinkCustomerControl';
export { CustomerMessagingPanel } from './components/CustomerMessagingPanel';
export { PortalSettingsCard } from './components/PortalSettingsCard';
export { SendToClientDialog, WriteToClientButton } from './components/SendToClientDialog';
export {
  useClientConversations,
  useClientMessages,
  useClientPortalAccess,
  useCloseConversation,
  useDocumentShares,
  useLinkDocumentCustomer,
  useMarkConversationRead,
  useSendClientMessage,
  useSetContactPortalAccess,
  useSetDocumentCustomerShares,
  useShareAttachments,
  useShareDocument,
  useUnreadClientMessages,
  useUpdatePortalSettings,
} from './hooks/useClientPortal';
