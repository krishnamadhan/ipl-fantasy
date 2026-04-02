import { create } from "zustand";
import type { IplPlayer } from "@/types/player";
import { validateTeam } from "@/lib/fantasy/validate-team";

export interface TeamDraft {
  selectedPlayers: IplPlayer[];
  captainId: string | null;
  vcId: string | null;
  teamName: string;
  savedTeamId: string | null;
}

function emptyDraft(index: number): TeamDraft {
  return { selectedPlayers: [], captainId: null, vcId: null, teamName: `Team ${index + 1}`, savedTeamId: null };
}

interface TeamBuilderState {
  drafts: TeamDraft[];
  activeIndex: number;
  matchId: string | null;
  matchTeams: { home: string; away: string } | null;

  // Active draft helpers
  active: () => TeamDraft;
  selectedPlayers: () => IplPlayer[];
  captainId: () => string | null;
  vcId: () => string | null;
  teamName: () => string;
  totalCredits: () => number;
  getErrors: () => string[];
  isValid: () => boolean;

  // Actions on active draft
  addPlayer: (player: IplPlayer) => void;
  removePlayer: (playerId: string) => void;
  setCaptain: (playerId: string) => void;
  setVC: (playerId: string) => void;
  setTeamName: (name: string) => void;

  // Multi-team
  setActiveIndex: (i: number) => void;
  addNewDraft: () => void;
  loadDraft: (index: number, draft: Partial<TeamDraft>) => void;
  resetDraft: (index: number) => void;
  setMatchId: (id: string) => void;
  setMatchTeams: (teams: { home: string; away: string }) => void;
}

export const useTeamBuilderStore = create<TeamBuilderState>((set, get) => ({
  drafts: [emptyDraft(0)],
  activeIndex: 0,
  matchId: null,
  matchTeams: null,

  active: () => get().drafts[get().activeIndex] ?? emptyDraft(get().activeIndex),

  selectedPlayers: () => get().active().selectedPlayers,
  captainId: () => get().active().captainId,
  vcId: () => get().active().vcId,
  teamName: () => get().active().teamName,

  totalCredits: () =>
    get().active().selectedPlayers.reduce((s, p) => s + p.credit_value, 0),

  getErrors: () => {
    const { selectedPlayers, captainId, vcId } = get().active();
    return validateTeam(selectedPlayers, captainId, vcId, get().matchTeams ?? undefined).errors;
  },

  isValid: () => {
    const { selectedPlayers, captainId, vcId } = get().active();
    return validateTeam(selectedPlayers, captainId, vcId, get().matchTeams ?? undefined).valid;
  },

  addPlayer: (player) =>
    set((s) => {
      const drafts = [...s.drafts];
      const draft = { ...drafts[s.activeIndex] };
      if (draft.selectedPlayers.find((p) => p.id === player.id)) return s;
      if (draft.selectedPlayers.length >= 11) return s;
      draft.selectedPlayers = [...draft.selectedPlayers, player];
      drafts[s.activeIndex] = draft;
      return { drafts };
    }),

  removePlayer: (playerId) =>
    set((s) => {
      const drafts = [...s.drafts];
      const draft = { ...drafts[s.activeIndex] };
      draft.selectedPlayers = draft.selectedPlayers.filter((p) => p.id !== playerId);
      if (draft.captainId === playerId) draft.captainId = null;
      if (draft.vcId === playerId) draft.vcId = null;
      drafts[s.activeIndex] = draft;
      return { drafts };
    }),

  setCaptain: (playerId) =>
    set((s) => {
      const drafts = [...s.drafts];
      const draft = { ...drafts[s.activeIndex] };
      draft.captainId = playerId;
      if (draft.vcId === playerId) draft.vcId = null;
      drafts[s.activeIndex] = draft;
      return { drafts };
    }),

  setVC: (playerId) =>
    set((s) => {
      const drafts = [...s.drafts];
      const draft = { ...drafts[s.activeIndex] };
      draft.vcId = playerId;
      if (draft.captainId === playerId) draft.captainId = null;
      drafts[s.activeIndex] = draft;
      return { drafts };
    }),

  setTeamName: (name) =>
    set((s) => {
      const drafts = [...s.drafts];
      drafts[s.activeIndex] = { ...drafts[s.activeIndex], teamName: name };
      return { drafts };
    }),

  setActiveIndex: (i) => set({ activeIndex: i }),

  addNewDraft: () =>
    set((s) => {
      if (s.drafts.length >= 6) return s;
      const newIndex = s.drafts.length;
      return { drafts: [...s.drafts, emptyDraft(newIndex)], activeIndex: newIndex };
    }),

  loadDraft: (index, draft) =>
    set((s) => {
      const drafts = [...s.drafts];
      while (drafts.length <= index) drafts.push(emptyDraft(drafts.length));
      drafts[index] = { ...drafts[index], ...draft };
      return { drafts, activeIndex: index };
    }),

  resetDraft: (index) =>
    set((s) => {
      const drafts = [...s.drafts];
      drafts[index] = emptyDraft(index);
      return { drafts };
    }),

  setMatchId: (id) => set({ matchId: id }),
  setMatchTeams: (teams) => set({ matchTeams: teams }),
}));
