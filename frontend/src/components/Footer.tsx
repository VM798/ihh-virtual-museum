import { Link } from "react-router-dom";
import Social, { IHH_LINKS } from "./Social";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <a href={IHH_LINKS.site} target="_blank" rel="noreferrer"><img className="footer-logo" src="/ihh/ihh-logo-white.png" alt="Immigrant Hall of Honor" /></a>
          <p style={{ margin: "0 0 10px", maxWidth: 420 }}>
            <strong>Document. Preserve. Honor.</strong> The Immigrant Hall of Honor documents, preserves and honors the many ways immigrants and their
            descendants have shaped, and continue to shape, the United States.
          </p>
          <Social />
        </div>
        <div className="footer-col">
          <h4>Explore</h4>
          <Link to="/inductees">Inductees</Link>
          <Link to="/timeline">Timeline</Link>
          <Link to="/share">Share a Story</Link>
          <Link to="/educators">For educators</Link>
          <Link to="/sources">Source library</Link>
          <Link to="/integrate">For the IHH web team</Link>
        </div>
        <div className="footer-col">
          <h4>Organization</h4>
          <Link to="/about">About Us</Link>
          <Link to="/contact">Contact Us</Link>
          <a href={IHH_LINKS.donate} target="_blank" rel="noreferrer">Donate ↗</a>
          <a href={IHH_LINKS.nominate} target="_blank" rel="noreferrer">Nominate someone ↗</a>
          <a href={IHH_LINKS.site} target="_blank" rel="noreferrer">immigranthallofhonor.org ↗</a>
        </div>
      </div>
      <div className="container footer-note">
        IHH (Immigrant Hall of Honor) Virtual Museum · a Challenge X prototype built for the Immigrant Hall of Honor. Every claim is cited; every link is checked.
        Portraits and media are public domain or openly licensed as credited. <a href="/docs" target="_blank" rel="noreferrer">API docs</a>
      </div>
    </footer>
  );
}
