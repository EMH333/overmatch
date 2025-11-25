import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { OsmElement } from "../objects";
import { MatchInfo } from "../types/matching";

interface ElementStore {
  overpassElements: OsmElement[];
  currentElement: number;
  uploadElements: OsmElement[];
  skippedOvertureIds: string[];
  skippedOsmIds: string[];
  elementMatches: Map<string, MatchInfo[]>;
  selectedMatchIndices: Map<string, number>;
  setOverpassElements: (ways: OsmElement[]) => void;
  setCurrentElement: (index: number) => void;
  setUploadElements: (ways: OsmElement[]) => void;
  addToUpload: (way: OsmElement) => void;
  addSkippedOvertureId: (id: string) => void;
  addSkippedOsmId: (id: string) => void;
  setElementMatches: (osmId: string, matches: MatchInfo[]) => void;
  setSelectedMatchIndex: (osmId: string, index: number) => void;
  resetElements: () => void;
}

export const useElementStore = create<ElementStore>()(
  persist(
    (set) => ({
      overpassElements: [],
      currentElement: 0,
      uploadElements: [],
      skippedOvertureIds: [],
      skippedOsmIds: [],
      elementMatches: new Map(),
      selectedMatchIndices: new Map(),
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
      addSkippedOsmId: (id) =>
        set((state) => ({
          skippedOsmIds: [...state.skippedOsmIds, id],
        })),
      setElementMatches: (osmId, matches) =>
        set((state) => {
          const newMap = new Map(state.elementMatches);
          newMap.set(osmId, matches);
          // Initialize selected match index to 0 for this element
          const newIndicesMap = new Map(state.selectedMatchIndices);
          if (!newIndicesMap.has(osmId)) {
            newIndicesMap.set(osmId, 0);
          }
          return {
            elementMatches: newMap,
            selectedMatchIndices: newIndicesMap,
          };
        }),
      setSelectedMatchIndex: (osmId, index) =>
        set((state) => {
          const newMap = new Map(state.selectedMatchIndices);
          newMap.set(osmId, index);
          return { selectedMatchIndices: newMap };
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
        skippedOsmIds: state.skippedOsmIds,
      }),
    },
  ),
);
