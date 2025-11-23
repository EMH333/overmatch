import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { OsmElement } from "../objects";
import { MatchInfo } from "../types/matching";

interface ElementStore {
  overpassElements: OsmElement[];
  currentElement: number;
  uploadElements: OsmElement[];
  skippedOvertureIds: string[];
  elementMatches: Map<string, MatchInfo[]>;
  setOverpassElements: (ways: OsmElement[]) => void;
  setCurrentElement: (index: number) => void;
  setUploadElements: (ways: OsmElement[]) => void;
  addToUpload: (way: OsmElement) => void;
  addSkippedOvertureId: (id: string) => void;
  setElementMatches: (osmId: string, matches: MatchInfo[]) => void;
  resetElements: () => void;
}

export const useElementStore = create<ElementStore>()(
  persist(
    (set) => ({
      overpassElements: [],
      currentElement: 0,
      uploadElements: [],
      skippedOvertureIds: [],
      elementMatches: new Map(),
      setOverpassElements: (ways) => set({ overpassElements: ways }),
      setCurrentElement: (index) => set({ currentElement: index }),
      setUploadElements: (ways) => set({ uploadElements: ways }),
      addToUpload: (way) =>
        set((state) => ({
          uploadElements: [...state.uploadElements, way],
        })),
      addSkippedOvertureId: (id) =>
        set((state) => ({
          skippedOvertureIds: [...state.skippedOvertureIds, id],
        })),
      setElementMatches: (osmId, matches) =>
        set((state) => {
          const newMap = new Map(state.elementMatches);
          newMap.set(osmId, matches);
          return { elementMatches: newMap };
        }),
      resetElements: () =>
        set({
          overpassElements: [],
          currentElement: 0,
        }),
    }),
    {
      name: "overmatch-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        uploadElements: state.uploadElements,
        skippedOvertureIds: state.skippedOvertureIds,
      }),
    },
  ),
);
