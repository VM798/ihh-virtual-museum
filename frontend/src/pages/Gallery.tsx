import { useMemo, useState } from "react";
import InducteeCard from "../components/InducteeCard";
import Loader, { ErrorBox } from "../components/Loader";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";

export default function Gallery() {
  const { data, error } = useFetch(() => api.inductees(), []);
  const [field, setField] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [sort, setSort] = useState<"name" | "born" | "arrived">("name");

  const fields = useMemo(() => Array.from(new Set((data ?? []).map((d) => d.field))).sort(), [data]);
  const regions = useMemo(() => Array.from(new Set((data ?? []).map((d) => d.origin_region))).sort(), [data]);
  const shown = useMemo(() => {
    const list = (data ?? []).filter((d) => (!field || d.field === field) && (!region || d.origin_region === region));
    return list.sort((a, b) => sort === "name" ? a.name.split(" ").slice(-1)[0].localeCompare(b.name.split(" ").slice(-1)[0]) : sort === "born" ? a.born_year - b.born_year : a.immigration_year - b.immigration_year);
  }, [data, field, region, sort]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loader />;

  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow">The inductees</span>
            <h2>Ten lives, ten journeys</h2>
            <p>Filter by field or by the part of the world each inductee came from.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["name", "born", "arrived"] as const).map((s) => <button key={s} className={`chip ${sort === s ? "active" : ""}`} onClick={() => setSort(s)}>sort: {s}</button>)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 26 }}>
          <button className={`chip ${!field && !region ? "active" : ""}`} onClick={() => { setField(null); setRegion(null); }}>All</button>
          {fields.map((f) => <button key={f} className={`chip ${field === f ? "active" : ""}`} onClick={() => setField(field === f ? null : f)}>{f}</button>)}
          <span style={{ width: 1, background: "var(--line)", margin: "0 6px" }} />
          {regions.map((r) => <button key={r} className={`chip ${region === r ? "active" : ""}`} onClick={() => setRegion(region === r ? null : r)}>{r}</button>)}
        </div>
        <div className="grid cols-4">
          {shown.map((p, idx) => <InducteeCard key={p.slug} i={p} index={idx} />)}
        </div>
        {!shown.length && <p className="muted">No inductees match those filters.</p>}
      </div>
    </section>
  );
}
