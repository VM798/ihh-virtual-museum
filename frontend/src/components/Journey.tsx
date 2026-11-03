import { motion } from "framer-motion";
import type { Inductee } from "../lib/types";

export default function Journey({ i }: { i: Inductee }) {
  const path = "M 40 150 C 200 20, 420 20, 580 150";
  return (
    <div className="journey">
      <span className="eyebrow">The journey</span>
      <svg viewBox="0 0 620 190" aria-hidden="true">
        <defs>
          <linearGradient id={`g-${i.slug}`} x1="0" x2="1"><stop offset="0" stopColor="#7db2f1" /><stop offset="1" stopColor={i.accent} /></linearGradient>
        </defs>
        <path d={path} stroke="rgba(13,90,182,0.15)" strokeWidth="2" fill="none" strokeDasharray="4 6" />
        <motion.path d={path} stroke={`url(#g-${i.slug})`} strokeWidth="3" fill="none" strokeLinecap="round"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.8, ease: "easeInOut" }} />
        <circle cx="40" cy="150" r="8" fill="#7db2f1" />
        <text x="40" y="180" textAnchor="middle" fill="#4a5568" fontSize="13" fontWeight="600">{i.origin.flag} {i.origin.place}</text>
        <motion.circle cx="580" cy="150" r="9" fill={i.accent} initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 1.6, type: "spring" }} />
        <text x="580" y="180" textAnchor="middle" fill="#1a202c" fontSize="13" fontWeight="600">🇺🇸 {i.immigration.arrived.split(",")[0]}</text>
        <text x="310" y="52" textAnchor="middle" fill="#0d5ab6" fontSize="30" fontWeight="800" fontFamily="Montserrat, sans-serif">{i.immigration.year}</text>
      </svg>
      <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.9rem" }}>{i.immigration.detail}</p>
      <div className="journey-points">
        <div><div className="y">{i.born.year}</div><div className="l">Born, {i.born.place.split(",")[0]}</div></div>
        <div><div className="y">{i.immigration.year}</div><div className="l">Arrived at {i.born.year ? i.immigration.year - i.born.year : "?"} years old</div></div>
        <div><div className="y">{i.citizenship_year ?? "—"}</div><div className="l">{i.citizenship_year ? "U.S. citizen" : "Citizenship not confirmed"}</div></div>
      </div>
    </div>
  );
}
