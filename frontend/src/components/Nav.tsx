import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { SearchHit } from "../lib/types";

export default function Nav() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => {
      api.search(q).then((h) => { setHits(h.slice(0, 6)); setOpen(true); }).catch(() => setHits([]));
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand" aria-label="IHH (Immigrant Hall of Honor) Virtual Museum - home">
          <img className="brand-logo" src="/ihh/ihh-logo-blue.png" alt="Immigrant Hall of Honor logo" width="400" height="120" />
          <span className="brand-text">
            <span className="brand-title">IHH <span className="brand-full">(Immigrant Hall of Honor)</span></span>
            <span className="brand-sub">Virtual Museum</span>
          </span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/inductees">Inductees</NavLink>
          <NavLink to="/timeline">Timeline</NavLink>
          <NavLink to="/sources">Sources</NavLink>
          <NavLink to="/integrate">Integrate</NavLink>
        </nav>
        <div className="nav-search" ref={box}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            placeholder="Search people, places, ideas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => hits.length && setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) { navigate(`/inductees/${hits[0].slug}`); setOpen(false); setQ(""); } }}
          />
          {open && hits.length > 0 && (
            <div className="search-pop">
              {hits.map((h) => (
                <Link key={h.slug} to={`/inductees/${h.slug}`} onClick={() => { setOpen(false); setQ(""); }}>
                  <img src={h.thumbnail} alt="" />
                  <div><strong>{h.name}</strong><small>{h.snippet.slice(0, 110)}</small></div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
