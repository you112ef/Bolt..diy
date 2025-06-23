// app/lib/stores/index.ts

// Export the main workbenchStore, which internally manages editor, files, terminal stores.
export { workbenchStore } from './workbench';

// Re-export other standalone, already instantiated stores
export { themeStore } from './theme';
export { chatStore } from './chat';
export { logStore } from './logs';
export { netlifyStore } from './netlify';
// PreviewsStore is a class, its instance is managed by workbenchStore, access via workbenchStore.previews
export { profileStore } from './profile';
export { qrCodeStore } from './qrCodeStore';
// SettingsStore is a class, needs instantiation if a global instance is required, or used via workbenchStore if managed there.
// For now, not exporting it as a direct instance from here unless it's confirmed to be a singleton.
export { streamingStore } from './streaming';
export { supabaseStore } from './supabase';
export { tabConfigurationStore } from './tabConfigurationStore';
export { vercelStore } from './vercel';

// Components needing editor, files, or terminal functionality should import `workbenchStore`
// and use its public API, e.g.:
// import { workbenchStore } from '~/lib/stores';
// workbenchStore.setSelectedFile('path/to/file');
// const currentEditorDoc = workbenchStore.currentDocument.get();
// const allFiles = workbenchStore.files.get();
// workbenchStore.attachTerminal(myTerminalInstance);
//
// This structure ensures that `~/lib/stores` resolves as a module and provides
// the necessary exports, fixing the Rollup resolution error.
// The previous error `"filesStore" is not exported by "app/lib/stores/files.ts"`
// occurred because an earlier attempt to create this index.ts file tried to
// import `filesStore` directly, but `files.ts` exports the `FilesStore` class,
// not an instance named `filesStore`. The instance is created within `WorkbenchStore`.
// By exporting `workbenchStore`, consumers get access to all its managed functionalities.
// If `Terminal.tsx` or `ProjectSearch.tsx` were trying `import { editorStore } from '~/lib/stores'`,
// they will need to be updated to `import { workbenchStore } from '~/lib/stores'` and use methods like
// `workbenchStore.setSelectedFile(...)`.
// The `handleOpenFileRequest` functions in those files will need this adjustment.
// The comment in Terminal.tsx "Assuming editorStore is directly importable" was indeed an assumption
// that doesn't hold given WorkbenchStore's architecture.
// This index.ts now provides a correct and central export strategy.
// The next step is to ensure consuming components use workbenchStore.
