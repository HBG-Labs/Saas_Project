import { AiChatBox, useAiAssistant } from '@/features/ai';
import { PERMISSIONS, usePermission } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function AiAssistantPage() {
  useDocumentTitle('Assistant IA');

  const { can } = usePermission();
  const canManageDocuments = can(PERMISSIONS.aiManageDocuments);

  const {
    messages,
    isGenerating,
    error,
    isDegraded,
    isQuotaExceeded,
    suggestions,
    searchHistory,
    sendMessage,
    executeAction,
    clearConversation,
    selectSuggestion,
    removeSearchHistoryItem,
    clearSearchHistory,
  } = useAiAssistant();

  return (
    <div className="h-[calc(100dvh-10.5rem)] md:h-[calc(100dvh-7.5rem)] w-full flex flex-col overflow-hidden">
      <AiChatBox
        messages={messages}
        isGenerating={isGenerating}
        error={error}
        isDegraded={isDegraded}
        isQuotaExceeded={isQuotaExceeded}
        canManageDocuments={canManageDocuments}
        suggestions={suggestions}
        searchHistory={searchHistory}
        onSendMessage={sendMessage}
        onExecuteAction={executeAction}
        onClear={clearConversation}
        onSelectSuggestion={selectSuggestion}
        onSelectSearchHistory={sendMessage}
        onRemoveSearchHistoryItem={removeSearchHistoryItem}
        onClearSearchHistory={clearSearchHistory}
      />
    </div>
  );
}
