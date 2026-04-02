import type { MatchStatus } from "@/types/match";

export const VALID_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  scheduled:  ['open', 'abandoned'],
  open:       ['locked', 'abandoned'],
  locked:     ['live', 'abandoned'],
  live:       ['in_review', 'abandoned', 'no_result'],
  in_review:  ['completed', 'live'],  // can revert to live for rescoring
  completed:  [],
  abandoned:  [],
  no_result:  [],
};

export function canTransition(from: MatchStatus, to: MatchStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Human-readable label for each status */
export const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled:  'Scheduled',
  open:       'Open',
  locked:     'Locked',
  live:       'Live',
  in_review:  'In Review',
  completed:  'Completed',
  abandoned:  'Abandoned',
  no_result:  'No Result',
};
