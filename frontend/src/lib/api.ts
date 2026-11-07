import type { AuthStatus, ChatMessage, ChatReply, ContactIn, DocentAnswer, DocentStatus, ExploreLink, GlobalTimelineEvent, Inductee, InducteeSummary, MuseumBay, Narration, SearchHit, SourceWithOwner, Stats, Story, StoryIn, StoryType, User } from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json() as Promise<T>;
}

// POST JSON; turns FastAPI validation errors into a readable sentence.
async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const d = await res.json();
      if (typeof d.detail === "string") msg = d.detail;
      else if (Array.isArray(d.detail)) msg = d.detail.map((x: { loc?: unknown[]; msg: string }) => `${String((x.loc ?? []).slice(-1)[0] ?? "field")}: ${x.msg}`).join("; ");
    } catch { /* keep the status text */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
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
  ask: (slug: string, question: string) => post<DocentAnswer>("/api/docent/ask", { slug, question }),
  chat: (messages: ChatMessage[], page?: string) => post<ChatReply>("/api/docent/chat", { messages, page }),
  annotate: (slug: string, mediaId: string) => post<DocentAnswer>("/api/docent/annotate", { slug, media_id: mediaId }),
  exportUrl: (slug: string, format: "md" | "html" | "json") => `${BASE}/api/inductees/${slug}/export.${format}${format === "html" ? "?download=true" : ""}`,
  narration: (slug: string) => get<Narration>(`/api/inductees/${slug}/narration`),
  narrationUrl: (slug: string) => `${BASE}/api/inductees/${slug}/narration.mp3`,
  lessonUrl: (slug: string) => `${BASE}/api/inductees/${slug}/lesson.md`,
  explore: () => get<ExploreLink[]>("/api/explore"),
  museum: () => get<MuseumBay[]>("/api/museum"),
  imageProxy: (url: string) => `${BASE}/api/image?url=${encodeURIComponent(url)}`,
  // Community
  stories: (status?: string) => get<Story[]>(`/api/stories${status ? `?status=${status}` : ""}`),
  storyTypes: () => get<{ id: StoryType; label: string }[]>("/api/stories/types"),
  submitStory: (body: StoryIn) => post<Story>("/api/stories", body),
  contactTopics: () => get<string[]>("/api/contact/topics"),
  submitContact: (body: ContactIn) => post<{ id: string; received_at: string }>("/api/contact", body),
  myStories: () => get<Story[]>("/api/stories/mine"),
  // Accounts
  me: () => get<AuthStatus>("/api/auth/me"),
  register: (body: { name: string; email: string; password: string }) => post<User>("/api/auth/register", body),
  login: (body: { email: string; password: string }) => post<User>("/api/auth/login", body),
  logout: () => post<void>("/api/auth/logout"),
};
