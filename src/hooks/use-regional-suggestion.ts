import { useEffect, useState } from "react";
import { getRegionalHint } from "@/lib/regional-hint.functions";
import { getSavedRegionalHint, rememberRegionalHint, type RegionalSuggestion } from "@/lib/regional-suggestion";

let ongoing: Promise<RegionalSuggestion | null> | null = null;

/** Reuses a six-hour session hint across pages, without asking for GPS. */
export function useRegionalSuggestion() {
  const [area, setArea] = useState<RegionalSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const sync = () => {
      if (active) {
        const value = getSavedRegionalHint();
        setArea(value);
        if (value) setLoading(false);
      }
    };
    window.addEventListener("eut-regional-hint", sync);
    const saved = getSavedRegionalHint();
    if (saved) { setArea(saved); setLoading(false); }
    else {
      if (!ongoing) {
        ongoing = getRegionalHint().then(value => {
          if (value) rememberRegionalHint(value);
          return value;
        }).catch(() => null).finally(() => { ongoing = null; });
      }
      void ongoing.then(() => {
        if (!active) return;
        setArea(getSavedRegionalHint());
        setLoading(false);
      });
    }
    return () => { active = false; window.removeEventListener("eut-regional-hint", sync); };
  }, []);
  return { area, loading };
}
