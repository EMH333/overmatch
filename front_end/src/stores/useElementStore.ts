import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { OsmElement } from "../objects";

interface ElementStore {
  overpassElements: OsmElement[];
  currentElement: number;
  uploadElements: OsmElement[];
  setOverpassElements: (ways: OsmElement[]) => void;
  setCurrentElement: (index: number) => void;
  setUploadElements: (ways: OsmElement[]) => void;
  addToUpload: (way: OsmElement) => void;
  resetElements: () => void;
}

export const useElementStore = create<ElementStore>()(
  persist(
    (set) => ({
      overpassElements: [],
      currentElement: 0,
      uploadElements: [],
      setOverpassElements: (ways) => set({ overpassElements: ways }),
      setCurrentElement: (index) => set({ currentElement: index }),
      setUploadElements: (ways) => set({ uploadElements: ways }),
      addToUpload: (way) =>
        set((state) => ({
          uploadElements: [...state.uploadElements, way],
        })),
      resetElements: () =>
        set({
          overpassElements: [],
          currentElement: 0,
        }),
    }),
    {
      name: "tigerking-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ uploadElements: state.uploadElements }),
    },
  ),
);
