import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { normalizeChoice, rankChoices, type ChoiceOption } from "@/lib/searchable-options";

interface SearchableChoiceProps {
  id: string;
  value: string;
  options: readonly ChoiceOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onCustom?: (text: string) => void;
  customLabel?: string;
  /** Optional fields keep the confirmed value while browsing; commit changes only explicitly. */
  clearOnEdit?: boolean;
}

// Keep a text query separate from the explicit, canonical selection. Never
// silently replace a choice with an approximate match or keep a stale ID.
export function SearchableChoice({ id, value, options, onChange, placeholder = "Digite para pesquisar", className, onCustom, customLabel = "Usar outra opção", clearOnEdit = true }: SearchableChoiceProps) {
  const selected = options.find(option => option.value === value);
  const label = selected?.displayLabel ?? selected?.label ?? "";
  const [query, setQuery] = useState(label);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const results = rankChoices(options, editing ? query : "");
  const custom = Boolean(onCustom && editing && query.trim() && !results.some(option => normalizeChoice(option.label) === normalizeChoice(query)));
  const count = results.length + Number(custom);
  const listId = id + "-choices";

  useEffect(() => {
    if (!editing) setQuery(label);
  }, [label, editing]);
  useEffect(() => {
    if (open && active >= 0) list.current?.querySelector<HTMLElement>('[data-choice-index="' + active + '"]')?.scrollIntoView?.({ block: "nearest", behavior: "auto" });
  }, [active, open]);

  function commit(index: number) {
    const option = results[index];
    if (option) {
      setQuery(option.displayLabel ?? option.label);
      onChange(option.value);
    } else if (custom && index === results.length) {
      onCustom?.(query.trim().slice(0, 100));
      setQuery("");
    } else return;
    input.current?.focus({ preventScroll: true });
    setEditing(false);
    setOpen(false);
    setActive(-1);
  }

  return <div className="relative min-w-0" data-searchable-choice>
    <div className="relative">
      <input ref={input} id={id} autoComplete="off" type="text" role="combobox"
        aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 && active < count ? listId + "-" + active : undefined}
        data-choice-value={value} className={(className ?? "") + " pr-12"}
        value={query} maxLength={140} placeholder={placeholder}
        onFocus={e => { setOpen(true); setActive(-1); e.currentTarget.select(); }}
        onClick={() => setOpen(true)}
        onBlur={() => { setOpen(false); setActive(-1); if (!clearOnEdit) setEditing(false); }}
        onChange={e => { setQuery(e.target.value); setEditing(true); setOpen(true); setActive(-1); if (clearOnEdit && value) onChange(""); }}
        onKeyDown={e => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); setOpen(true);
            if (count) setActive(previous => e.key === "ArrowDown" ? (previous + 1) % count : (previous < 0 ? count - 1 : (previous - 1 + count) % count));
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            const exact = results.filter(option => normalizeChoice(option.label) === normalizeChoice(query) || normalizeChoice(option.displayLabel ?? option.label) === normalizeChoice(query));
            if (active >= 0 && active < count) commit(active);
            else if (exact.length === 1) commit(results.indexOf(exact[0]!));
            else if (count === 1) commit(0);
          } else if (e.key === "Escape" && open) {
            e.preventDefault(); e.stopPropagation(); setOpen(false); setActive(-1); if (!clearOnEdit) setEditing(false);
          }
        }}
      />
      <button type="button" aria-label={open ? "Ocultar sugestões" : "Mostrar sugestões"} tabIndex={-1}
        className="absolute inset-y-1 right-0 flex w-12 items-center justify-center text-muted-foreground"
        onMouseDown={e => e.preventDefault()}
        onClick={() => { if (open) { setOpen(false); setActive(-1); } else { input.current?.focus({ preventScroll: true }); setOpen(true); } }}>
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>
    </div>
    {open && <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border bg-background shadow-lg" data-choice-suggestions>
      <p className="px-3 pt-2 text-xs text-muted-foreground">{editing ? "Selecione uma sugestão" : "Digite para filtrar as opções"}</p>
      <div ref={list} id={listId} role="listbox" aria-label="Sugestões" className="max-h-56 overflow-y-auto overscroll-contain p-1">
        {results.map((option, i) => <div key={option.value} id={listId + "-" + i} data-choice-index={i} data-option-value={option.value}
          role="option" aria-selected={active === i || (active < 0 && value === option.value)}
          onMouseDown={e => e.preventDefault()} onClick={() => commit(i)}
          className={"flex min-h-12 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm " + (active === i ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
          <span className="min-w-0 break-words"><span className="block font-medium">{option.label}</span>{option.detail && <span className="block text-xs text-muted-foreground">{option.detail}</span>}</span>
          {value === option.value && <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />}
        </div>)}
        {custom && <div id={listId + "-" + results.length} data-choice-index={results.length} data-option-value="__custom"
          role="option" aria-selected={active === results.length} onMouseDown={e => e.preventDefault()} onClick={() => commit(results.length)}
          className={"min-h-12 cursor-pointer rounded-lg px-3 py-3 text-sm font-semibold text-primary break-words " + (active === results.length ? "bg-primary/10" : "hover:bg-muted")}>{customLabel}: “{query.trim()}”</div>}
      </div>
      {count === 0 && <p role="status" className="px-3 pb-3 text-sm text-muted-foreground">Nenhuma opção encontrada. Tente outro termo.</p>}
    </div>}
    {editing && !value && !open && query.trim() && <p className="mt-1 text-xs text-muted-foreground">Confirme uma sugestão para continuar.</p>}
  </div>;
}
