import { create } from 'zustand';

interface UnsavedChangesState {
  activeDirtyInputs: Set<string>;
  isDirty: boolean;
  setDirty: (inputId: string, dirty: boolean) => void;
  resetDirtyState: () => void;
}

export const useUnsavedChangesStore = create<UnsavedChangesState>((set, get) => ({
  activeDirtyInputs: new Set(),
  isDirty: false,
  setDirty: (inputId: string, dirty: boolean) => {
    const currentDirtyInputs = new Set(get().activeDirtyInputs);
    if (dirty) {
      currentDirtyInputs.add(inputId);
    } else {
      currentDirtyInputs.delete(inputId);
    }
    set({ activeDirtyInputs: currentDirtyInputs, isDirty: currentDirtyInputs.size > 0 });
  },
  resetDirtyState: () => {
    set({ activeDirtyInputs: new Set(), isDirty: false });
  },
}));
