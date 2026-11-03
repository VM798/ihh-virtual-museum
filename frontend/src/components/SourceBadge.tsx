import type { Verification } from "../lib/types";

export default function SourceBadge({ v }: { v: Verification }) {
  if (v.method === "manual") return <span className="badge badge-manual" title={v.note ?? ""}>✓ verified manually {v.checked_at ?? ""}</span>;
  if (v.status === "ok") return <span className="badge badge-ok" title={v.note ?? ""}>✓ link ok {v.checked_at ? `· ${v.checked_at}` : ""}</span>;
  if (v.status === "blocked") return <span className="badge badge-blocked" title="The publisher blocks automated requests; open in a browser to confirm">⚠ blocks bots ({v.http_status})</span>;
  if (v.status === "error") return <span className="badge badge-error" title={v.note ?? ""}>✕ check failed</span>;
  return <span className="badge badge-unchecked">not checked</span>;
}
