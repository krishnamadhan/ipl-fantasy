import type { CricApiMatch, CricApiScorecard, CricApiSquad } from "./types";

const BASE = "https://api.cricapi.com/v1";

async function get<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.CRICAPI_KEY!;
  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set("apikey", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`CricAPI ${endpoint} failed: ${res.status}`);

  const data = await res.json();
  if (!data.status || data.status !== "success") {
    throw new Error(`CricAPI error: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function fetchSeriesMatches(seriesId: string): Promise<CricApiMatch[]> {
  const data = await get<{ data: CricApiMatch[] }>("series_info", { id: seriesId });
  return data.data;
}

export async function fetchMatchInfo(matchId: string): Promise<CricApiMatch> {
  const data = await get<{ data: CricApiMatch }>("match_info", { id: matchId });
  return data.data;
}

export async function fetchMatchScore(matchId: string): Promise<CricApiMatch> {
  const data = await get<{ data: CricApiMatch }>("match_score", { id: matchId });
  return data.data;
}

export async function fetchMatchScorecard(matchId: string): Promise<CricApiScorecard> {
  const data = await get<{ data: CricApiScorecard }>("match_scorecard", { id: matchId });
  return data.data;
}

export async function fetchSeriesSquads(seriesId: string): Promise<CricApiSquad[]> {
  const data = await get<{ data: CricApiSquad[] }>("series_squad", { id: seriesId });
  return data.data;
}
