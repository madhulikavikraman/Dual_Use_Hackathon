// Emoji with accessible text. Decorative by default (aria-hidden, the words sit next to it); with `label` it is an
// image with that name. People counts render "👥 ~118,000" on screen and "about 118,000 people" to a screen reader.
import { ICON, peopleLong, peopleShort } from "./icons";

export function Emoji({ e, label, className = "" }: { e: string; label?: string; className?: string }) {
  if (label) {
    return (
      <span role="img" aria-label={label} title={label} className={`vf-emoji ${className}`}>
        {e}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`vf-emoji ${className}`}>
      {e}
    </span>
  );
}

/** "👥 ~118,000", read as "about 118,000 people". */
export function People({ n, className = "", icon = true }: { n: number; className?: string; icon?: boolean }) {
  const long = peopleLong(n);
  return (
    <span className={`whitespace-nowrap ${className}`} title={long}>
      <span aria-hidden="true">
        {icon ? <span className="vf-emoji">{ICON.people}</span> : null}
        {icon ? " " : ""}
        {peopleShort(n)}
      </span>
      <span className="sr-only">{long}</span>
    </span>
  );
}
