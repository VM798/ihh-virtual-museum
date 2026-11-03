import type { Source } from "../lib/types";

export default function Cite({ ids, sources }: { ids: string[]; sources: Source[] }) {
  if (!ids.length) return null;
  const index = new Map(sources.map((s, i) => [s.id, { n: i + 1, s }]));
  return (
    <span className="cite">
      {ids.map((id) => {
        const entry = index.get(id);
        if (!entry) return null;
        return (
          <a key={id} href={`#src-${id}`} title={`${entry.s.title} — ${entry.s.publisher}`}>[{entry.n}]</a>
        );
      })}
    </span>
  );
}
