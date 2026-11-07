import { Suspense, lazy } from "react";
const MuseumHall = lazy(() => import("../components/MuseumHall"));

export default function MuseumPage() {
  return (
    <section className="museum-page">
      <Suspense fallback={<div className="hall hall-full"><div className="hall-loading">Opening the doors…</div></div>}><MuseumHall fullscreen /></Suspense>
    </section>
  );
}
