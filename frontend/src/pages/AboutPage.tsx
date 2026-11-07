import { Link } from "react-router-dom";
import Social, { IHH_LINKS } from "../components/Social";

const SRC = <a href={IHH_LINKS.mission} target="_blank" rel="noreferrer" className="src-link">immigranthallofhonor.org/mission-and-vision ↗</a>;

export default function AboutPage() {
  return (
    <>
      <section className="section about-hero">
        <div className="container">
          <span className="eyebrow">About Us</span>
          <h1 style={{ margin: "8px 0 14px" }}>Document. Preserve. Honor.</h1>
          <p className="lead-wide">
            Long before, and since, 1776, foreign-born individuals have shaped what would become the United States.
            The Immigrant Hall of Honor celebrates those contributions and preserves the stories behind them.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container about-grid">
          <div className="card about-card">
            <span className="eyebrow">Our mission</span>
            <blockquote className="about-quote">Immigrant Hall of Honor documents, preserves and honors the many ways immigrants and their descendants have shaped, and continue to shape, the United States.</blockquote>
            <small className="faint">Source: {SRC}</small>
          </div>
          <div className="card about-card">
            <span className="eyebrow">See the dream</span>
            <blockquote className="about-quote">The ultimate vision of the Immigrant Hall of Honor is a large national museum in Texas where visitors learn, often in interactive fashion, about the contributions that immigrants have been making to the United States since 1776.</blockquote>
            <p className="muted small">In agriculture, architecture, art, business, American cuisine, education, engineering, government, literature and journalism, medicine, music, theater and film, science and math, technology and other fields.</p>
            <small className="faint">Source: {SRC}</small>
          </div>
          <div className="card about-card">
            <span className="eyebrow">Our history</span>
            <p>Established in 2024, the Immigrant Hall of Honor is founded on Sara Puig Laas' vision for a national museum celebrating the history and achievements of immigrants who came from all over the world to the United States.</p>
            <p className="muted">Sara intended the museum to remind Americans that the United States is a nation of immigrants and to acknowledge the diverse roots of the people who make up the country. She envisioned a place where visitors could explore the history of immigration, learn about their own origins, and better understand the experiences and contributions of others.</p>
            <small className="faint">Source: {SRC}</small>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container feature">
          <div>
            <span className="eyebrow">About this virtual museum</span>
            <h2 style={{ margin: "10px 0 16px" }}>A first exhibit, built for the web</h2>
            <p className="muted">
              This site is a Challenge X prototype for the Immigrant Hall of Honor: an interactive, verifiable version of the inductee profiles,
              designed to drop straight into immigranthallofhonor.org. Ten inductees are profiled so far, every claim is cited to a checked source,
              and all media is public domain or openly licensed as credited.
            </p>
            <p className="muted">
              It also opens the door to the museum's next chapter: visitors can <Link to="/share" style={{ color: "var(--gold)", textDecoration: "underline" }}>share their own immigration story</Link>,
              and teachers can follow any life page by page on the <Link to="/timeline" style={{ color: "var(--gold)", textDecoration: "underline" }}>timeline</Link>.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              <Link to="/integrate" className="btn">For the IHH web team →</Link>
              <Link to="/sources" className="btn">Source library →</Link>
            </div>
          </div>
          <div className="grid cols-2">
            {[
              ["🏛️", "Leadership", "Meet the board and team behind the museum.", IHH_LINKS.leadership],
              ["📰", "Newsroom", "Announcements, press and milestones.", IHH_LINKS.newsroom],
              ["🧱", "Donate", "Help lay the foundation for the museum in Central Texas.", IHH_LINKS.donate],
              ["🏅", "Nominate", "Put forward an immigrant whose story deserves honoring.", IHH_LINKS.nominate],
            ].map(([icon, title, body, url]) => (
              <a className="card about-link" key={title} href={url} target="_blank" rel="noreferrer">
                <div className="icon-circle">{icon}</div>
                <strong>{title} ↗</strong>
                <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.9rem" }}>{body}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container about-cta">
          <div>
            <span className="eyebrow">Stay in touch</span>
            <h2>Questions, ideas, or a story to tell?</h2>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link to="/contact" className="btn btn-primary">Contact us</Link>
            <Link to="/share" className="btn">Share a story</Link>
            <Social labels />
          </div>
        </div>
      </section>
    </>
  );
}
