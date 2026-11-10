import { useEffect, useRef, useState } from "react";

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
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ value, onCommit });
  latest.current = { value, onCommit };

  // Back/forward navigation and external filter changes keep the input in
  // sync unless the visitor is actively typing.
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  function commit(next: string) {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    if (next !== latest.current.value) latest.current.onCommit(next);
  }

  function change(next: string) {
    setDraft(next);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), FILTER_DEBOUNCE_MS);
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
        onFocus={() => { focused.current = true; }}
        onChange={(event) => change(event.target.value)}
        onBlur={() => {
          focused.current = false;
          commit(draft);
          onBlurTrack(draft);
        }}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}
