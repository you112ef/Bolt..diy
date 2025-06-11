import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ChatHistoryItem } from './useChatHistory';
import type { Snapshot } from './types'; // Import Snapshot type

export interface IChatMetadata {
  gitUrl: string;
  gitBranch?: string;
  netlifySiteId?: string;
}

const logger = createScopedLogger('ChatHistory');

// this is used at the top level and never rejects
export async function openDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') {
    console.error('indexedDB is not available in this environment.');
    return undefined;
  }

  return new Promise((resolve) => {
    const request = indexedDB.open('boltHistory', 4);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('chats')) {
          const store = db.createObjectStore('chats', { keyPath: 'id' });
          store.createIndex('id', 'id', { unique: true });
          store.createIndex('urlId', 'urlId', { unique: true });
        }
      }

      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'chatId' });
        }
      }
      // Check for version 3 for offlineRequests store
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('offlineRequests')) {
          const store = db.createObjectStore('offlineRequests', { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      }
      // Check for version 4 for userSettings store
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains('userSettings')) {
          db.createObjectStore('userSettings', { keyPath: 'key' });
        }
      }
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      resolve(undefined);
      logger.error((event.target as IDBOpenDBRequest).error);
    };
  });
}

// --- User Settings Functions ---

export async function getUserSetting(db: IDBDatabase, key: string): Promise<any | undefined> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains('userSettings')) {
      // This can happen if DB is not fully upgraded yet or if called too early.
      console.warn('userSettings store not found, returning undefined for key:', key);
      resolve(undefined);
      return;
    }
    const transaction = db.transaction('userSettings', 'readonly');
    const store = transaction.objectStore('userSettings');
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result?.value); // Assuming value is stored in a 'value' property of the stored object
    };
    request.onerror = (event) => reject('Failed to get user setting: ' + (event.target as IDBRequest).error);
  });
}

export async function setUserSetting(db: IDBDatabase, key: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains('userSettings')) {
       console.error('userSettings store not found. Cannot set key:', key);
       reject(new Error('userSettings store not found'));
       return;
    }
    const transaction = db.transaction('userSettings', 'readwrite');
    const store = transaction.objectStore('userSettings');
    // The object store uses 'key' as keyPath, so we store { key: key, value: value }
    const request = store.put({ key, value });

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject('Failed to set user setting: ' + (event.target as IDBRequest).error);
  });
}

export async function deleteUserSetting(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains('userSettings')) {
      console.warn('userSettings store not found. Cannot delete key:', key);
      resolve(); // Resolve without error if store doesn't exist, as the goal is to remove the setting.
      return;
    }
    const transaction = db.transaction('userSettings', 'readwrite');
    const store = transaction.objectStore('userSettings');
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject('Failed to delete user setting: ' + (event.target as IDBRequest).error);
  });
}

// --- Offline Request Queue Functions ---

export async function addOfflineRequest(
  db: IDBDatabase,
  requestData: { url: string; method: string; headers: object; body: any; timestamp: number }
): Promise<number> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('offlineRequests', 'readwrite');
    const store = transaction.objectStore('offlineRequests');
    const request = store.add(requestData);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = (event) => reject('Failed to add offline request: ' + (event.target as IDBRequest).error);
  });
}

export async function getOldestOfflineRequest(db: IDBDatabase): Promise<any | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('offlineRequests', 'readonly');
    const store = transaction.objectStore('offlineRequests');
    const index = store.index('timestamp'); // Get oldest by timestamp
    const request = index.openCursor(null, 'next'); // 'next' gives ascending order

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        resolve(cursor.value);
      } else {
        resolve(undefined); // No requests in store
      }
    };
    request.onerror = (event) => reject('Failed to get oldest offline request: ' + (event.target as IDBRequest).error);
  });
}

export async function getAllOfflineRequests(db: IDBDatabase): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('offlineRequests', 'readonly');
    const store = transaction.objectStore('offlineRequests');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject('Failed to get all offline requests: ' + (event.target as IDBRequest).error);
  });
}

export async function deleteOfflineRequest(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('offlineRequests', 'readwrite');
    const store = transaction.objectStore('offlineRequests');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject('Failed to delete offline request: ' + (event.target as IDBRequest).error);
  });
}

export async function getAll(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as ChatHistoryItem[]);
    request.onerror = () => reject(request.error);
  });
}

export async function setMessages(
  db: IDBDatabase,
  id: string,
  messages: Message[],
  urlId?: string,
  description?: string,
  timestamp?: string,
  metadata?: IChatMetadata,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');

    if (timestamp && isNaN(Date.parse(timestamp))) {
      reject(new Error('Invalid timestamp'));
      return;
    }

    const request = store.put({
      id,
      messages,
      urlId,
      description,
      timestamp: timestamp ?? new Date().toISOString(),
      metadata,
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMessages(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return (await getMessagesById(db, id)) || (await getMessagesByUrlId(db, id));
}

export async function getMessagesByUrlId(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const index = store.index('urlId');
    const request = index.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function getMessagesById(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats', 'snapshots'], 'readwrite'); // Add snapshots store to transaction
    const chatStore = transaction.objectStore('chats');
    const snapshotStore = transaction.objectStore('snapshots');

    const deleteChatRequest = chatStore.delete(id);
    const deleteSnapshotRequest = snapshotStore.delete(id); // Also delete snapshot

    let chatDeleted = false;
    let snapshotDeleted = false;

    const checkCompletion = () => {
      if (chatDeleted && snapshotDeleted) {
        resolve(undefined);
      }
    };

    deleteChatRequest.onsuccess = () => {
      chatDeleted = true;
      checkCompletion();
    };
    deleteChatRequest.onerror = () => reject(deleteChatRequest.error);

    deleteSnapshotRequest.onsuccess = () => {
      snapshotDeleted = true;
      checkCompletion();
    };

    deleteSnapshotRequest.onerror = (event) => {
      if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
        snapshotDeleted = true;
        checkCompletion();
      } else {
        reject(deleteSnapshotRequest.error);
      }
    };

    transaction.oncomplete = () => {
      // This might resolve before checkCompletion if one operation finishes much faster
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getNextId(db: IDBDatabase): Promise<string> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const highestId = request.result.reduce((cur, acc) => Math.max(+cur, +acc), 0);
      resolve(String(+highestId + 1));
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getUrlId(db: IDBDatabase, id: string): Promise<string> {
  const idList = await getUrlIds(db);

  if (!idList.includes(id)) {
    return id;
  } else {
    let i = 2;

    while (idList.includes(`${id}-${i}`)) {
      i++;
    }

    return `${id}-${i}`;
  }
}

async function getUrlIds(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const idList: string[] = [];

    const request = store.openCursor();

    request.onsuccess = (event: Event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        idList.push(cursor.value.urlId);
        cursor.continue();
      } else {
        resolve(idList);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function forkChat(db: IDBDatabase, chatId: string, messageId: string): Promise<string> {
  const chat = await getMessages(db, chatId);

  if (!chat) {
    throw new Error('Chat not found');
  }

  // Find the index of the message to fork at
  const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);

  if (messageIndex === -1) {
    throw new Error('Message not found');
  }

  // Get messages up to and including the selected message
  const messages = chat.messages.slice(0, messageIndex + 1);

  return createChatFromMessages(db, chat.description ? `${chat.description} (fork)` : 'Forked chat', messages);
}

export async function duplicateChat(db: IDBDatabase, id: string): Promise<string> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  return createChatFromMessages(db, `${chat.description || 'Chat'} (copy)`, chat.messages);
}

export async function createChatFromMessages(
  db: IDBDatabase,
  description: string,
  messages: Message[],
  metadata?: IChatMetadata,
): Promise<string> {
  const newId = await getNextId(db);
  const newUrlId = await getUrlId(db, newId); // Get a new urlId for the duplicated chat

  await setMessages(
    db,
    newId,
    messages,
    newUrlId, // Use the new urlId
    description,
    undefined, // Use the current timestamp
    metadata,
  );

  return newUrlId; // Return the urlId instead of id for navigation
}

export async function updateChatDescription(db: IDBDatabase, id: string, description: string): Promise<void> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  if (!description.trim()) {
    throw new Error('Description cannot be empty');
  }

  await setMessages(db, id, chat.messages, chat.urlId, description, chat.timestamp, chat.metadata);
}

export async function updateChatMetadata(
  db: IDBDatabase,
  id: string,
  metadata: IChatMetadata | undefined,
): Promise<void> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  await setMessages(db, id, chat.messages, chat.urlId, chat.description, chat.timestamp, metadata);
}

export async function getSnapshot(db: IDBDatabase, chatId: string): Promise<Snapshot | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readonly');
    const store = transaction.objectStore('snapshots');
    const request = store.get(chatId);

    request.onsuccess = () => resolve(request.result?.snapshot as Snapshot | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function setSnapshot(db: IDBDatabase, chatId: string, snapshot: Snapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.put({ chatId, snapshot });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSnapshot(db: IDBDatabase, chatId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.delete(chatId);

    request.onsuccess = () => resolve();

    request.onerror = (event) => {
      if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
        resolve();
      } else {
        reject(request.error);
      }
    };
  });
}
