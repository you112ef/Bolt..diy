import { atom, computed, map, type MapStore, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import type { FileMap, FilesStore } from './files';
import { createScopedLogger } from '~/utils/logger';

export type EditorDocuments = Record<string, EditorDocument>;

type SelectedFile = WritableAtom<string | undefined>;

const logger = createScopedLogger('EditorStore');

export class EditorStore {
  #filesStore: FilesStore;

  selectedFile: SelectedFile = import.meta.hot?.data.selectedFile ?? atom<string | undefined>();
  documents: MapStore<EditorDocuments> = import.meta.hot?.data.documents ?? map({});

  currentDocument = computed([this.documents, this.selectedFile], (documents, selectedFile) => {
    if (!selectedFile) {
      return undefined;
    }

    return documents[selectedFile];
  });

  constructor(filesStore: FilesStore) {
    this.#filesStore = filesStore;

    if (import.meta.hot) {
      import.meta.hot.data.documents = this.documents;
      import.meta.hot.data.selectedFile = this.selectedFile;
    }
    this.loadSession(); // Load session on initialization
  }

  // Save session to localStorage
  saveSession() {
    if (typeof window !== 'undefined') {
      const session = {
        selectedFile: this.selectedFile.get(),
        documents: this.documents.get(),
        // Add other relevant settings here if needed
      };
      localStorage.setItem('editorSession', JSON.stringify(session));
      logger.debug('Editor session saved');
    }
  }

  // Load session from localStorage
  loadSession() {
    if (typeof window !== 'undefined') {
      const savedSession = localStorage.getItem('editorSession');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          if (session.selectedFile) {
            this.selectedFile.set(session.selectedFile);
          }
          if (session.documents) {
            // We need to be careful here, as initial files might not be loaded yet.
            // This might be better handled after initial files are processed.
            // For now, let's assume documents can be set directly.
            // A more robust solution would merge this with initial file loading.
            this.documents.set(session.documents);
          }
          logger.debug('Editor session loaded');
        } catch (e) {
          logger.error('Failed to parse saved editor session', e);
          localStorage.removeItem('editorSession'); // Clear corrupted session
        }
      }
    }
  }

  setDocuments(files: FileMap) {
    const previousDocuments = this.documents.get(); // Use .get() instead of .value for nanostores MapStore

    this.documents.set(
      Object.fromEntries<EditorDocument>(
        Object.entries(files)
          .map(([filePath, dirent]) => {
            if (dirent === undefined || dirent.type !== 'file') {
              return undefined;
            }

            const previousDocument = previousDocuments?.[filePath];

            return [
              filePath,
              {
                value: dirent.content,
                filePath,
                scroll: previousDocument?.scroll,
              },
            ] as [string, EditorDocument];
          })
          .filter(Boolean) as Array<[string, EditorDocument]>,
      ),
    );
  }

  setSelectedFile(filePath: string | undefined) {
    this.selectedFile.set(filePath);
    this.saveSession(); // Save session when selected file changes
  }

  updateScrollPosition(filePath: string, position: ScrollPosition) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    this.documents.setKey(filePath, {
      ...documentState,
      scroll: position,
    });
    this.saveSession(); // Save session when scroll position changes
  }

  updateFile(filePath: string, newContent: string) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    // Check if the file is locked by getting the file from the filesStore
    const file = this.#filesStore.getFile(filePath);

    if (file?.isLocked) {
      logger.warn(`Attempted to update locked file: ${filePath}`);
      return;
    }

    /*
     * For scoped locks, we would need to implement diff checking here
     * to determine if the edit is modifying existing code or just adding new code
     * This is a more complex feature that would be implemented in a future update
     */

    const currentContent = documentState.value;
    const contentChanged = currentContent !== newContent;

    if (contentChanged) {
      this.documents.setKey(filePath, {
        ...documentState,
        value: newContent,
      });
      this.saveSession(); // Save session when file content changes
    }
  }
}
