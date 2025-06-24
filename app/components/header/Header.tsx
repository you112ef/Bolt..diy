import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';

export function Header() {
  const chat = useStore(chatStore);

  return (
    <header
      className={classNames('flex items-center px-3 border-b h-[var(--header-height)]', { // Adjusted padding
        'border-transparent': !chat.started,
        'border-bolt-elements-borderColor': chat.started,
      })}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <div className="i-ph:sidebar-simple-duotone text-xl" /> {/* Reduced icon size */}
        <a href="/" className="text-lg font-semibold text-accent flex items-center"> {/* Reduced text size */}
          {/* <span className="i-bolt:logo-text?mask w-[46px] inline-block" /> */}
          <img src="https://d.top4top.io/p_3448rqs6n1.png" alt="logo" className="w-[70px] inline-block dark:hidden" /> {/* Reduced image width */}
          <img src="https://d.top4top.io/p_3448rqs6n1.png" alt="logo" className="w-[70px] inline-block hidden dark:block" /> {/* Reduced image width */}
        </a>
      </div>
      {chat.started && ( // Display ChatDescription and HeaderActionButtons only when the chat has started.
        <>
          <span className="flex-1 px-2 truncate text-center text-bolt-elements-textPrimary text-xs"> {/* Added text-xs */}
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
          <ClientOnly>
            {() => (
              <div className="">
                <HeaderActionButtons chatStarted={chat.started} />
              </div>
            )}
          </ClientOnly>
        </>
      )}
    </header>
  );
}
