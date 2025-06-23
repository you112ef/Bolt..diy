import type { Message } from 'ai';
import { Fragment } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { useLocation } from '@remix-run/react';
import { db, chatId } from '~/lib/persistence/useChatHistory';
import { forkChat } from '~/lib/persistence/db';
import { toast } from 'react-toastify';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';
import type { ProviderInfo } from '~/types/model';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
  append?: (message: Message) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
  provider?: ProviderInfo;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>, messageText: string) => void; // Added for drag and drop
}

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id, isStreaming = false, messages = [], onDragStart } = props;
    const location = useLocation();

    const handleRewind = (messageId: string) => {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('rewindTo', messageId);
      window.location.search = searchParams.toString();
    };

    const handleFork = async (messageId: string) => {
      try {
        if (!db || !chatId.get()) {
          toast.error('Chat persistence is not available');
          return;
        }

        const urlId = await forkChat(db, chatId.get()!, messageId);
        window.location.href = `/chat/${urlId}`;
      } catch (error) {
        toast.error('Failed to fork chat: ' + (error as Error).message);
      }
    };

    return (
      <div id={id} className={props.className} ref={ref}>
        {messages.length > 0
          ? messages.map((message, index) => {
              const { role, content, id: messageId, annotations } = message;
              const isUserMessage = role === 'user';
              const isFirst = index === 0;
              const isHidden = annotations?.includes('hidden');

              if (isHidden) {
                return <Fragment key={index} />;
              }

              return (
                <div
                  key={index}
                  className={classNames('flex gap-4 py-3 w-full rounded-lg', {
                    'mt-4': !isFirst,
                  })}
                >
                  <div className="grid grid-col-1 w-full">
                    {isUserMessage ? (
                      <UserMessage content={content} />
                    ) : (
                      <div // Wrap AssistantMessage for drag functionality
                        draggable={!!onDragStart} // Make draggable only if onDragStart is provided
                        onDragStart={(e) => {
                          if (onDragStart && typeof content === 'string') {
                            onDragStart(e, content);
                          } else if (onDragStart && Array.isArray(content)) {
                            // Attempt to find a text part of the message for dragging
                            const textContent = content.find((part) => part.type === 'text');

                            if (textContent && typeof textContent.text === 'string') {
                              onDragStart(e, textContent.text);
                            }
                          }
                        }}
                      >
                        <AssistantMessage
                          content={content}
                          annotations={message.annotations}
                          messageId={messageId}
                          onRewind={handleRewind}
                          onFork={handleFork}
                          append={props.append}
                          chatMode={props.chatMode}
                          setChatMode={props.setChatMode}
                          model={props.model}
                          provider={props.provider}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          : null}
        {isStreaming && (
          <div className="text-center w-full  text-bolt-elements-item-contentAccent i-svg-spinners:3-dots-fade text-4xl mt-4"></div>
        )}
      </div>
    );
  },
);
