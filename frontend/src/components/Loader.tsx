export default function Loader({ text = "Opening the gallery…" }: { text?: string }) {
  return (
    <div className="loader">
      <div className="spinner" />
      {text}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="container section">
      <div className="card" style={{ borderColor: "rgba(224,102,102,0.5)" }}>
        <h3>Could not reach the museum API</h3>
        <p className="muted">{message}. Make sure the FastAPI backend is running on port 8010.</p>
      </div>
    </div>
  );
}
