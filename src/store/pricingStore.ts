import { create } from 'zustand';

type StatusType = "all" | "ok" | "pending" | "failed";

interface PricingStore {
  provider: string;
  accountId: string | null;
  q: string;
  onlyUnmapped: boolean;
  status: StatusType;
  page: number;
  pageSize: number;
  selectionIds: string[];
  isLoading: boolean;

  setProvider: (provider: string) => void;
  setAccount: (accountId: string | null) => void;
  setQuery: (q: string) => void;
  toggleOnlyUnmapped: () => void;
  setStatus: (status: StatusType) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  setLoading: (v: boolean) => void;
}

export const usePricingStore = create<PricingStore>((set, get) => ({
  provider: "ebay",
  accountId: null,
  q: "",
  onlyUnmapped: true,
  status: "all",
  page: 1,
  pageSize: 50,
  selectionIds: [],
  isLoading: false,

  setProvider: (provider: string) => {
    set({ provider });
  },

  setAccount: (accountId: string | null) => {
    set({ accountId });
  },

  setQuery: (q: string) => {
    set({ q });
  },

  toggleOnlyUnmapped: () => {
    set(state => ({ onlyUnmapped: !state.onlyUnmapped }));
  },

  setStatus: (status: StatusType) => {
    set({ status });
  },

  setPage: (page: number) => {
    set({ page });
  },

  setPageSize: (size: number) => {
    set({ pageSize: size });
  },

  toggleSelection: (id: string) => {
    set(state => {
      const currentIds = state.selectionIds;
      const isSelected = currentIds.includes(id);

      if (isSelected) {
        return { selectionIds: currentIds.filter(existingId => existingId !== id) };
      } else {
        return { selectionIds: [...new Set([...currentIds, id])] };
      }
    });
  },

  clearSelection: () => {
    set({ selectionIds: [] });
  },

  setLoading: (v: boolean) => {
    set({ isLoading: v });
  },
}));
