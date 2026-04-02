/**
 * Dismissal string parser — per spec Appendix B.
 *
 * Parses strings like:
 *   "c Jadeja b Bumrah"            → caught, fielder=Jadeja, bowler=Bumrah
 *   "c & b Bumrah"                 → caught & bowled (fielder=bowler=Bumrah)
 *   "b Bumrah"                     → bowled
 *   "lbw b Ashwin"                 → lbw
 *   "st †Dhoni b Chahal"           → stumped
 *   "run out (Kohli)"              → run out direct (fielder=Kohli)
 *   "run out (Kohli/Jadeja)"       → run out indirect (f1=Kohli, f2=Jadeja)
 *   "hit wicket b Bumrah"          → hit wicket
 *   "retired hurt"                 → retired
 *   "not out"                      → not out
 */

export type DismissalType =
  | "bowled"
  | "caught"
  | "caught_and_bowled"
  | "lbw"
  | "stumped"
  | "run_out"
  | "hit_wicket"
  | "retired"
  | "not_out";

export interface DismissalResult {
  type: DismissalType;
  bowler?: string;
  fielder?: string;   // catcher / stumper / primary run-out fielder
  fielder2?: string;  // secondary run-out fielder
  isDirectHit?: boolean;
}

export function parseDismissal(raw: string): DismissalResult {
  if (!raw) return { type: "not_out" };
  const s = raw.trim().toLowerCase();

  if (s === "not out" || s === "batting" || s === "") {
    return { type: "not_out" };
  }

  if (s.startsWith("retired")) {
    return { type: "retired" };
  }

  if (s.startsWith("hit wicket")) {
    const bowler = extractBowler(raw);
    return { type: "hit_wicket", bowler };
  }

  if (s.startsWith("run out")) {
    return parseRunOut(raw);
  }

  if (s.startsWith("st") || s.startsWith("stumped")) {
    const { fielder, bowler } = parseCatchOrStump(raw, "st");
    return { type: "stumped", fielder: clean(fielder), bowler: clean(bowler) };
  }

  // "c & b Bumrah" or "c and b Bumrah"
  if (/^c\s*(&|and)\s*b\b/i.test(raw)) {
    const bowler = extractBowler(raw);
    return { type: "caught_and_bowled", fielder: clean(bowler), bowler: clean(bowler) };
  }

  if (s.startsWith("c ") || s.startsWith("caught")) {
    const { fielder, bowler } = parseCatch(raw);
    return { type: "caught", fielder: clean(fielder), bowler: clean(bowler) };
  }

  if (s.startsWith("lbw")) {
    const bowler = extractBowler(raw);
    return { type: "lbw", bowler: clean(bowler) };
  }

  if (s.startsWith("b ")) {
    const bowler = raw.replace(/^b\s+/i, "").trim();
    return { type: "bowled", bowler: clean(bowler) };
  }

  // Fallback — unknown
  return { type: "not_out" };
}

// ─── helpers ────────────────────────────────────────────────────────────────

function clean(name?: string): string | undefined {
  if (!name) return undefined;
  // Strip wicketkeeper dagger and trailing spaces
  return name.replace(/†/g, "").trim() || undefined;
}

function extractBowler(raw: string): string | undefined {
  // Find "b <Name>" near end of string
  const m = raw.match(/\bb\s+([A-Za-z\s'-]+)$/i);
  return m ? m[1].trim() : undefined;
}

function parseCatch(raw: string): { fielder?: string; bowler?: string } {
  // "c Jadeja b Bumrah" or "caught Jadeja bowled Bumrah"
  const m = raw.match(/^c(?:aught)?\s+([†A-Za-z\s'-]+?)\s+b(?:owled)?\s+([A-Za-z\s'-]+)$/i);
  if (m) return { fielder: m[1].trim(), bowler: m[2].trim() };
  return { bowler: extractBowler(raw) };
}

function parseCatchOrStump(raw: string, prefix: "st"): { fielder?: string; bowler?: string } {
  // "st †Dhoni b Chahal"
  const m = raw.match(/^st(?:umped)?\s+([†A-Za-z\s'-]+?)\s+b(?:owled)?\s+([A-Za-z\s'-]+)$/i);
  if (m) return { fielder: m[1].trim(), bowler: m[2].trim() };
  return { bowler: extractBowler(raw) };
}

function parseRunOut(raw: string): DismissalResult {
  // "run out (Kohli)" → direct hit
  // "run out (Kohli/Jadeja)" → relay throw, both get assist credit
  const m = raw.match(/run\s+out\s*\(([^)]+)\)/i);
  if (!m) return { type: "run_out", isDirectHit: true };

  const inner = m[1].trim();
  if (inner.includes("/")) {
    const [f1, f2] = inner.split("/").map((s) => s.trim());
    // Two fielders = indirect relay run-out
    return { type: "run_out", fielder: f1, fielder2: f2, isDirectHit: false };
  }

  // Single fielder = direct hit
  return { type: "run_out", fielder: inner, isDirectHit: true };
}
