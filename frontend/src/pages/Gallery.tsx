import { useMemo, useState } from "react";
import InducteeCard from "../components/InducteeCard";
import Loader, { ErrorBox } from "../components/Loader";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import type { InducteeSummary } from "../lib/types";

// Letter groups for the A–Z bar. Inductees are filed by surname, like the IHH inductee directory.
const GROUPS: [string, string][] = [["A", "D"], ["E", "H"], ["I", "L"], ["M", "P"], ["Q", "T"], ["U", "Z"]];
const surname = (p: InducteeSummary) => p.name.split(" ").slice(-1)[0];
const initial = (p: InducteeSummary) => surname(p)[0].toUpperCase();
const inGroup = (letter: string, [a, b]: [string, string]) => letter >= a && letter <= b;

export default function Gallery() {
  const { data, error } = useFetch(() => api.inductees(), []);
  const [group, setGroup] = useState<number | null>(null);
  const [field, setField] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [order, setOrder] = useState<"az" | "born" | "arrived">("az");

  const fields = useMemo(() => Array.from(new Set((data ?? []).map((d) => d.field))).sort(), [data]);
  const regions = useMemo(() => Array.from(new Set((data ?? []).map((d) => d.origin_region))).sort(), [data]);
  const counts = useMemo(() => GROUPS.map((g) => (data ?? []).filter((p) => inGroup(initial(p), g)).length), [data]);

  const shown = useMemo(() => {
    const list = (data ?? []).filter((d) =>
      (group === null || inGroup(initial(d), GROUPS[group])) && (!field || d.field === field) && (!region || d.origin_region === region));
    return list.sort((a, b) => order === "az" ? surname(a).localeCompare(surname(b)) : order === "born" ? a.born_year - b.born_year : a.immigration_year - b.immigration_year);
  }, [data, group, field, region, order]);

  // When filed A–Z, show a heading for each surname initial, like a directory.
  const byLetter = useMemo(() => {
    const m = new Map<string, InducteeSummary[]>();
    shown.forEach((p) => m.set(initial(p), [...(m.get(initial(p)) ?? []), p]));
    return Array.from(m.entries());
  }, [shown]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loader />;

  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow">The inductees</span>
            <h2>Ten lives, ten journeys</h2>
            <p>Filed by last name. Pick a letter group, or narrow by field and by the part of the world each inductee came from.</p>
          </div>
          <div className="order-chips" role="group" aria-label="Order">
            <span className="faint small">Order:</span>
            {([["az", "A–Z"], ["born", "Birth year"], ["arrived", "Year of arrival"]] as const).map(([k, label]) => (
              <button key={k} className={`chip ${order === k ? "active" : ""}`} onClick={() => setOrder(k)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="alpha-bar" role="group" aria-label="Browse by last name">
          <button className={`alpha-btn ${group === null ? "on" : ""}`} onClick={() => setGroup(null)}>All <small>{data.length}</small></button>
          {GROUPS.map(([a, b], i) => (
            <button key={a} className={`alpha-btn ${group === i ? "on" : ""}`} disabled={!counts[i]} onClick={() => setGroup(group === i ? null : i)} aria-pressed={group === i}>
              {a}–{b} <small>{counts[i]}</small>
            </button>
          ))}
        </div>

        <div className="filter-row">
          <button className={`chip ${!field && !region ? "active" : ""}`} onClick={() => { setField(null); setRegion(null); }}>Everyone</button>
          {fields.map((f) => <button key={f} className={`chip ${field === f ? "active" : ""}`} onClick={() => setField(field === f ? null : f)}>{f}</button>)}
          <span className="filter-sep" />
          {regions.map((r) => <button key={r} className={`chip ${region === r ? "active" : ""}`} onClick={() => setRegion(region === r ? null : r)}>{r}</button>)}
          <span className="faint small" style={{ marginLeft: "auto" }}>Showing {shown.length} of {data.length}</span>
        </div>

        {order === "az" ? byLetter.map(([letter, people]) => (
          <div className="alpha-section" key={letter}>
            <div className="alpha-letter"><b>{letter}</b><span>{people.map(surname).join(", ")}</span></div>
            <div className="grid cols-4">
              {people.map((p, idx) => <InducteeCard key={p.slug} i={p} index={idx} />)}
            </div>
          </div>
        )) : (
          <div className="grid cols-4">
            {shown.map((p, idx) => <InducteeCard key={p.slug} i={p} index={idx} />)}
          </div>
        )}
        {!shown.length && <p className="muted">No inductees match those filters.</p>}
      </div>
    </section>
  );
}
