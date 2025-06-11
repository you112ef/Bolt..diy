import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { useState, useEffect } from 'react'; // Ensure useState, useEffect are imported
import { toast } from 'react-toastify';
import { IconButton, Tooltip } from '~/components/ui';
import { streamingState } from '~/lib/stores/streaming';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { useChatHistory } from '~/lib/persistence';
import { DeployButton } from '~/components/deploy/DeployButton';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted }: HeaderActionButtonsProps) {
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const isStreaming = useStore(streamingState);
  const { exportChat } = useChatHistory();
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const shouldShowButtons = !isStreaming && activePreview;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          text: 'Check out this Bolt AI page!', // Or a more specific text
          url: window.location.href,
        });
        toast.success('Shared successfully!');
      } catch (error: any) {
        // Don't show an error if the user cancels the share dialog
        if (error.name === 'AbortError') {
          console.log('Share dialog aborted by user');
          return;
        }
        console.error('Error sharing:', error);
        toast.error('Could not share at this time.');
      }
    } else {
      // Fallback for browsers that do not support Web Share API
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.info('Web Share not supported. Link copied to clipboard!');
      } catch (copyError) {
        toast.error('Web Share not supported, and failed to copy link.');
        console.error('Fallback copy to clipboard failed:', copyError);
      }
    }
  };

  const handleToggleFullscreen = async () => {
    if (!document.fullscreenEnabled) {
      toast.error('Fullscreen mode is not supported by your browser.');
      return;
    }

    try {
      if (!isFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
      toast.error('Could not toggle fullscreen mode.');
    }
  };

  return (
    <div className="flex items-center flex-wrap wrap justify-end gap-2">
      {chatStarted && shouldShowButtons && <ExportChatButton exportChat={exportChat} />}
      {shouldShowButtons && <DeployButton />}
      {shouldShowButtons && (
        <Tooltip content="Share this page">
          <IconButton
            onClick={handleShare}
            aria-label="Share this page"
            variant="ghost"
          >
            <div className="i-ph:share-network text-lg" />
          </IconButton>
        </Tooltip>
      )}
      {shouldShowButtons && ( // Conditionally render fullscreen button
        <Tooltip content={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
          <IconButton
            onClick={handleToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            variant="ghost"
          >
            {isFullscreen ? (
              <div className="i-ph:arrows-in-simple text-lg" />
            ) : (
              <div className="i-ph:arrows-out-simple text-lg" />
            )}
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
}
