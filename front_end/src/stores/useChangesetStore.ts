import { create } from "zustand";

interface RelationType {
  id: string;
  name?: string;
}

interface ChangesetStoreState {
  relation: RelationType;
  host: string;
  description: string;
  databaseVersion: string;
  setRelation: (relation: RelationType) => void;
  setHost: (host: string) => void;
  setDescription: (location: string) => void;
  setDatabaseVersion: (version: string) => void;
  resetDescription: () => void;
}

export const useChangesetStore = create<ChangesetStoreState>((set) => ({
  relation: { id: "", name: "" },
  host: "",
  description: "",
  databaseVersion: "",
  setRelation: (relation) =>
    set((state) => ({
      relation: {
        id: relation.id,
        name: relation.name || state.relation.name,
      },
    })),
  setHost: (host) => set({ host }),
  setDescription: (location) =>
    set({
      description: `Adding details to amenities${location ? ` in ${location}` : ""}`,
    }),
  setDatabaseVersion: (version) => set({ databaseVersion: version }),
  resetDescription: () =>
    set({
      description: "Adding details to amenities",
    }),
}));
