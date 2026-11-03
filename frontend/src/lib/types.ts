export interface Verification {
  method: "http" | "manual" | "unchecked";
  status: "ok" | "blocked" | "redirect" | "error" | "unchecked";
  http_status: number | null;
  checked_at: string | null;
  note: string | null;
}

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  kind: string;
  access: string;
  note: string | null;
  verification: Verification;
}

export interface Media {
  id: string;
  kind: "image" | "audio" | "video" | "document";
  title: string;
  url: string;
  embed_url: string | null;
  thumbnail: string | null;
  year: string | null;
  credit: string;
  license: string;
  license_url: string | null;
  description: string;
  annotation: string | null;
  rights_note: string | null;
  source_id: string | null;
}

export interface Paragraph { text: string; source_ids: string[] }
export interface Achievement { title: string; year: string | null; description: string; source_ids: string[] }
export interface Honor { title: string; year: number | null; source_ids: string[] }
export interface TimelineEvent {
  year: number; date: string | null; title: string; description: string;
  category: "origins" | "immigration" | "career" | "milestone" | "honor" | "legacy";
  source_ids: string[];
}
export interface Quote { text: string; context: string; source_id: string }
export interface FunFact { text: string; source_ids: string[] }
export interface ReviewNote { ihh_statement: string; finding: string; severity: "correction" | "clarification" | "unverified"; source_ids: string[] }
export interface LifeEvent { year: number; date: string | null; place: string }
export interface Origin { country: string; place: string; flag: string; region: string }
export interface Immigration { year: number; arrived: string; detail: string; source_ids: string[] }
export interface HeroImage { url: string; thumbnail: string; credit: string; license: string; license_url: string | null; source_url: string }

export interface Inductee {
  slug: string; name: string; birth_name: string; tagline: string; field: string; tags: string[]; accent: string;
  born: LifeEvent; died: LifeEvent | null; origin: Origin; immigration: Immigration; citizenship_year: number | null;
  occupations: string[]; hero_image: HeroImage; summary: string; biography: Paragraph[]; achievements: Achievement[];
  honors: Honor[]; timeline: TimelineEvent[]; quotes: Quote[]; fun_facts: FunFact[]; discussion_prompts: string[];
  media: Media[]; review_notes: ReviewNote[]; sources: Source[]; ihh_page_url: string; wikipedia_url: string;
}

export interface InducteeSummary {
  slug: string; name: string; tagline: string; field: string; tags: string[]; accent: string; born_year: number;
  died_year: number | null; origin_country: string; origin_flag: string; origin_region: string; immigration_year: number;
  thumbnail: string; summary: string; source_count: number; media_count: number; event_count: number;
}

export interface GlobalTimelineEvent extends TimelineEvent { slug: string; name: string; accent: string; thumbnail: string }
export interface SourceWithOwner extends Source { inductee_slug: string; inductee_name: string }
export interface Stats {
  inductees: number; sources: number; verified_sources: number; media: number; timeline_events: number; countries: number;
  span_start: number; span_end: number; fields: Record<string, number>; regions: Record<string, number>;
}
export interface SearchHit { slug: string; name: string; thumbnail: string; accent: string; score: number; matched_in: string[]; snippet: string }
export interface DocentAnswer { answer: string; cited_source_ids: string[]; model: string | null; grounded: boolean; note: string | null }
export interface DocentStatus { enabled: boolean; model: string; live: boolean }
