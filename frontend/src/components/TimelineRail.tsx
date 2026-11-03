import { motion } from "framer-motion";
import Cite from "./Citation";
import type { Source, TimelineEvent } from "../lib/types";

const DOT: Record<TimelineEvent["category"], string> = {
  origins: "#718096", immigration: "#d60810", career: "#0d5ab6", milestone: "#2f855a", honor: "#b7791f", legacy: "#6b46c1",
};

export default function TimelineRail({ events, sources }: { events: TimelineEvent[]; sources: Source[] }) {
  return (
    <div className="timeline">
      {events.map((e, idx) => (
        <motion.div className="tl-item" key={`${e.year}-${idx}`} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.45 }}>
          <span className="dot" style={{ background: DOT[e.category] }} />
          <div className="when">{e.date ?? e.year}<span className={`cat cat-${e.category}`}>{e.category}</span></div>
          <div className="title">{e.title}</div>
          <div className="desc">{e.description}<Cite ids={e.source_ids} sources={sources} /></div>
        </motion.div>
      ))}
    </div>
  );
}
