import React from 'react';
import { classNames } from '~/utils/classNames';

export function ChatMessageSkeleton() {
  const skeletonBubble = (isUser: boolean = false) => (
    <div
      className={classNames(
        'flex animate-pulse space-x-3 py-3',
        isUser ? 'justify-end' : ''
      )}
    >
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0"></div>
      )}
      <div
        className={classNames(
          'flex-1 space-y-3 rounded-lg px-3 py-2 max-w-[75%]', // Max width for bubble
          isUser
            ? 'bg-purple-100 dark:bg-purple-800/30' // User-like bubble color
            : 'bg-slate-100 dark:bg-slate-800'    // Assistant-like bubble color
        )}
      >
        <div className="h-2 bg-slate-300 dark:bg-slate-600 rounded"></div>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="h-2 bg-slate-300 dark:bg-slate-600 rounded col-span-2"></div>
            <div className="h-2 bg-slate-300 dark:bg-slate-600 rounded col-span-1"></div>
          </div>
          <div className="h-2 bg-slate-300 dark:bg-slate-600 rounded w-3/4"></div>
        </div>
      </div>
      {isUser && (
        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0"></div>
      )}
    </div>
  );

  return (
    <div className="w-full space-y-4 p-2">
      {skeletonBubble(false)}
      {skeletonBubble(true)}
      {skeletonBubble(false)}
    </div>
  );
}

export default ChatMessageSkeleton;
