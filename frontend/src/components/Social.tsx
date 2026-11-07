// The IHH's own channels, as linked from immigranthallofhonor.org (checked 2026-11-03).
export const IHH_SITE = "https://immigranthallofhonor.org";
export const IHH_LINKS = {
  site: IHH_SITE,
  donate: `${IHH_SITE}/donate/`,
  nominate: `${IHH_SITE}/nominate/`,
  tellYourStory: `${IHH_SITE}/tell-your-story/`,
  mission: `${IHH_SITE}/mission-and-vision/`,
  leadership: `${IHH_SITE}/leadership/`,
  newsroom: `${IHH_SITE}/newsroom/`,
  contact: `${IHH_SITE}/contact/`,
};
export const SOCIAL = [
  { id: "instagram", label: "Instagram", url: "https://www.instagram.com/immigranthallofhonor/" },
  { id: "facebook", label: "Facebook", url: "https://www.facebook.com/immigranthallofhonor" },
  { id: "x", label: "X", url: "https://x.com/immigranthoh" },
  { id: "youtube", label: "YouTube", url: "https://www.youtube.com/@ImmigrantHallofHonor" },
  { id: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@immigranthallofhonor" },
] as const;

function Icon({ id }: { id: (typeof SOCIAL)[number]["id"] }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "instagram": return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
    case "facebook": return <svg {...common}><path d="M15 3h-2a4 4 0 0 0-4 4v3H6v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z" /></svg>;
    case "x": return <svg {...common}><path d="M4 4l16 16M20 4L4 20" /></svg>;
    case "youtube": return <svg {...common}><rect x="2.5" y="5" width="19" height="14" rx="4" /><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" /></svg>;
    case "tiktok": return <svg {...common}><path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 4c.5 2.5 2.2 4 4.5 4.3" /></svg>;
  }
}

export default function Social({ labels = false, className = "" }: { labels?: boolean; className?: string }) {
  return (
    <span className={`social-row ${className}`}>
      {SOCIAL.map((s) => (
        <a key={s.id} href={s.url} target="_blank" rel="noreferrer" aria-label={`IHH on ${s.label}`} title={s.label}>
          <Icon id={s.id} />{labels && <span>{s.label}</span>}
        </a>
      ))}
    </span>
  );
}
