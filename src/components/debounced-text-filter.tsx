import { useEffect, useRef, useState } from "react";
import { clearPendingFilter, readPendingFilter, savePendingFilter } from "@/lib/pending-search-filter";

/**
 * Keeps typing local so TanStack does not re-run the server loader for every
 * keystroke. Filter URLs still update after a brief pause and on blur.
 */
export const FILTER_DEBOUNCE_MS = 450;

type DebouncedTextFilterProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onCommit: (value: string) => void;
  onBlurTrack: (value: string) => void;
};

export function DebouncedTextFilter({
  id, label, value, placeholder, onCommit, onBlurTrack,
}: DebouncedTextFilterProps) {
  const [draft, setDraft] = useState(() => readPendingFilter(id, value) ?? value);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ value, onCommit });
  const latestDraft = useRef(draft);
  latest.current = { value, onCommit };
  latestDraft.current = draft;

  const inactive = () => document.visibilityState === "hidden" || !document.hasFocus();
  function schedule(next: string) {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!inactive()) commit(next);
      // Backgrounded tabs keep the last keystroke in sessionStorage until focus returns.
    }, FILTER_DEBOUNCE_MS);
  }

  // Back/forward navigation and external filter changes keep the input in
  // sync unless the visitor is actively typing.
  useEffect(() => {
    if (focused.current || readPendingFilter(id, value) !== null) return;
    // URL history wins over an unrelated old draft; cancel stale commits.
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setDraft(value);
    latestDraft.current = value;
  }, [id, value]);

  useEffect(() => {
    // Resume only when foregrounded. Mount restoration must not be discarded
    // by the URL-sync effect before the visitor can review the last edit.
    const resume = () => {
      if (!inactive() && latestDraft.current !== latest.current.value) {
        schedule(latestDraft.current);
      }
    };
    if (draft !== value) resume();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  function commit(next: string) {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    clearPendingFilter(id);
    if (next !== latest.current.value) latest.current.onCommit(next);
  }

  function change(next: string) {
    savePendingFilter(id, latest.current.value, next);
    latestDraft.current = next;
    setDraft(next);
    schedule(next);
  }

  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={draft}
        onFocus={() => {
          focused.current = true;
          if (latestDraft.current !== latest.current.value) schedule(latestDraft.current);
        }}
        onChange={(event) => change(event.target.value)}
        onBlur={() => {
          focused.current = false;
          if (inactive()) {
            // Alt+Tab and mobile app backgrounding must not trigger navigation.
            if (timer.current !== null) clearTimeout(timer.current);
            timer.current = null;
            return;
          }
          commit(draft);
          onBlurTrack(draft);
        }}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}
