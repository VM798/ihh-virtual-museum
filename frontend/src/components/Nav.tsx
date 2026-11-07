import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { SearchHit } from "../lib/types";
import Social, { IHH_LINKS } from "./Social";
import { useAuth } from "../lib/auth";

export default function Nav() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [acct, setAcct] = useState(false);
  const { user, ready, signOut } = useAuth();
  const acctBox = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const box = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  // Reading-progress ribbon across the very top of the page.
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  useEffect(() => { setMenu(false); setAcct(false); }, [pathname]);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => {
      api.search(q).then((h) => { setHits(h.slice(0, 6)); setOpen(true); }).catch(() => setHits([]));
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
      if (acctBox.current && !acctBox.current.contains(e.target as Node)) setAcct(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="nav">
      <div className="progress" ref={bar} aria-hidden="true" />
      {/* Utility bar, as on immigranthallofhonor.org: About Us, Contact Us, Donate, social channels */}
      <div className="topbar">
        <div className="container topbar-inner">
          <span className="topbar-note">A new museum coming to Central Texas</span>
          <nav className="topbar-links" aria-label="About and contact">
            <NavLink to="/about">About Us</NavLink>
            <NavLink to="/contact">Contact Us</NavLink>
            <a className="topbar-donate" href={IHH_LINKS.donate} target="_blank" rel="noreferrer">Donate ↗</a>
            {ready && (user ? (
              <div className="acct" ref={acctBox}>
                <button type="button" className="acct-btn" onClick={() => setAcct((a) => !a)} aria-expanded={acct} aria-haspopup="menu">
                  <span className="acct-avatar" aria-hidden="true">{user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                  <span className="acct-name">{user.name.split(/\s+/)[0]}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {acct && (
                  <div className="acct-menu" role="menu">
                    <div className="acct-menu-head"><strong>{user.name}</strong><small>{user.email}</small></div>
                    <Link role="menuitem" to="/account">My account</Link>
                    <Link role="menuitem" to="/share">Share a story</Link>
                    <button type="button" role="menuitem" onClick={() => { setAcct(false); signOut().then(() => navigate("/")); }}>Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <NavLink to="/signin" className="topbar-signin">Sign in</NavLink>
            ))}
            <Social className="topbar-social" />
          </nav>
        </div>
      </div>
      <div className="container nav-inner">
        <Link to="/" className="brand" aria-label="IHH (Immigrant Hall of Honor) Virtual Museum - home">
          <img className="brand-logo" src="/ihh/ihh-logo-blue.png" alt="Immigrant Hall of Honor logo" width="400" height="120" />
          <span className="brand-text">
            <span className="brand-title">IHH <span className="brand-full">(Immigrant Hall of Honor)</span></span>
            <span className="brand-sub">Virtual Museum</span>
          </span>
        </Link>
        <nav className={`nav-links ${menu ? "open" : ""}`} aria-label="Main">
          <NavLink to="/museum">Museum</NavLink>
          <NavLink to="/inductees">Inductees</NavLink>
          <NavLink to="/timeline">Timeline</NavLink>
          <NavLink to="/share">Share a Story</NavLink>
          <NavLink to="/educators">Educators</NavLink>
          <NavLink to="/sources">Sources</NavLink>
          <NavLink to="/integrate" className="mobile-only">Integrate</NavLink>
          <NavLink to="/about" className="mobile-only">About Us</NavLink>
          <NavLink to="/contact" className="mobile-only">Contact Us</NavLink>
          {ready && (user ? <NavLink to="/account" className="mobile-only">My account</NavLink> : <NavLink to="/signin" className="mobile-only">Sign in</NavLink>)}
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
        <button type="button" className="nav-burger" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <span /><span /><span />
        </button>
      </div>
    </header>
  );
}
