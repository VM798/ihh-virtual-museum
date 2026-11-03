import type { DocentAnswer, DocentStatus, GlobalTimelineEvent, Inductee, InducteeSummary, SearchHit, SourceWithOwner, Stats } from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  inductees: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return get<InducteeSummary[]>(`/api/inductees${qs}`);
  },
  inductee: (slug: string) => get<Inductee>(`/api/inductees/${slug}`),
  search: (q: string) => get<SearchHit[]>(`/api/inductees/search?q=${encodeURIComponent(q)}`),
  timeline: () => get<GlobalTimelineEvent[]>("/api/timeline"),
  sources: () => get<SourceWithOwner[]>("/api/sources"),
  stats: () => get<Stats>("/api/stats"),
  docentStatus: () => get<DocentStatus>("/api/docent/status"),
  ask: async (slug: string, question: string): Promise<DocentAnswer> => {
    const res = await fetch(`${BASE}/api/docent/ask`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, question }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },
  annotate: async (slug: string, mediaId: string): Promise<DocentAnswer> => {
    const res = await fetch(`${BASE}/api/docent/annotate`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, media_id: mediaId }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  },
  exportUrl: (slug: string, format: "md" | "html" | "json") => `${BASE}/api/inductees/${slug}/export.${format}${format === "html" ? "?download=true" : ""}`,
};
