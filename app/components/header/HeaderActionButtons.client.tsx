import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { useState, useEffect } from 'react';
import { streamingState } from '~/lib/stores/streaming';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { useChatHistory } from '~/lib/persistence';
import { DeployButton } from '~/components/deploy/DeployButton';
import { Button } from '~/components/ui/Button';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted }: HeaderActionButtonsProps) {
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const isStreaming = useStore(streamingState);
  const { exportChat } = useChatHistory();

  const shouldShowButtons = !isStreaming && activePreview;

  // PWA Install Prompt state
  const [installPromptEvent, setInstallPromptEvent] = useState<Event | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault(); // Prevent the mini-infobar
      setInstallPromptEvent(event);
      setShowInstallButton(true);
      console.log('beforeinstallprompt event captured');
    };

    // Check if running in a browser environment before adding event listener
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      }
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) {
      return;
    }
    // Cast to any to access prompt() and userChoice, as standard Event type doesn't have them.
    const promptEvent = installPromptEvent as any;
    promptEvent.prompt(); // Show the browser's install dialog

    const { outcome } = await promptEvent.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    setInstallPromptEvent(null); // Clear the event, it can only be used once
    setShowInstallButton(false); // Hide the button
  };

  return (
    <div className="flex items-center flex-wrap wrap justify-end gap-2">
      {showInstallButton && shouldShowButtons && (
        <Button onClick={handleInstallClick} variant="outline" size="sm">
          Install App
        </Button>
      )}
      {chatStarted && shouldShowButtons && <ExportChatButton exportChat={exportChat} />}
      {shouldShowButtons && <DeployButton />}
    </div>
  );
}
