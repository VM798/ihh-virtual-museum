import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { lifespan } from "../lib/hooks";
import type { InducteeSummary } from "../lib/types";

export default function InducteeCard({ i, index = 0 }: { i: InducteeSummary; index?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05, duration: 0.5 }}>
      <Link to={`/inductees/${i.slug}`} className="portrait-card">
        <span className="accent-bar" style={{ background: i.accent }} />
        <img src={i.thumbnail} alt={i.name} loading="lazy" />
        <div className="overlay" />
        <span className="flag">{i.origin_flag} {i.origin_country.split(" (")[0]}</span>
        <div className="meta">
          <span className="eyebrow">{i.field} · {lifespan(i.born_year, i.died_year)}</span>
          <h3>{i.name}</h3>
          <p>{i.tagline}</p>
        </div>
      </Link>
    </motion.div>
  );
}
