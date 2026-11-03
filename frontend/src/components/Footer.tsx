import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container" style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between" }}>
        <div>
          <a href="https://immigranthallofhonor.org" target="_blank" rel="noreferrer"><img className="footer-logo" src="/ihh/ihh-logo-white.png" alt="Immigrant Hall of Honor" /></a>
          <strong>IHH (Immigrant Hall of Honor) Virtual Museum</strong> · Challenge X prototype for the{" "}
          <a href="https://immigranthallofhonor.org" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Immigrant Hall of Honor</a>.
          <br />Every claim is cited; every link is checked. Portraits and media are public domain or openly licensed as credited.
        </div>
        <div className="footer-links" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Link to="/sources">Source library</Link>
          <Link to="/integrate">For the IHH web team</Link>
          <a href="/docs" target="_blank" rel="noreferrer">API docs</a>
        </div>
      </div>
    </footer>
  );
}
