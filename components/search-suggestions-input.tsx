"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";

type Suggestion = {
  title: string;
  slug: string;
};

async function fetchSuggestions(query: string, signal: AbortSignal): Promise<Suggestion[]> {
  const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) return [];
  return (await res.json()) as Suggestion[];
}

export function SearchSuggestionsInput({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(initialValue);
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  React.useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const handle = window.setTimeout(async () => {
      try {
        const next = await fetchSuggestions(q, controller.signal);
        setSuggestions(next);
        setOpen(next.length > 0);
        setActiveIndex(-1);
      } catch {
        // Ignore aborted requests.
      }
    }, 180);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [value]);

  const close = React.useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  React.useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest?.("[data-search-suggestions]")) return;
      close();
    }

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [close]);

  const applySuggestion = React.useCallback(
    (title: string) => {
      setValue(title);
      close();
      const params = new URLSearchParams(searchParams.toString());
      params.set("q", title.trim());
      params.delete("page");
      router.replace(`/?${params.toString()}`);
    },
    [close, router, searchParams]
  );

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        applySuggestion(suggestions[activeIndex].title);
        return;
      }
      close();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <div data-search-suggestions className="relative">
      <Input
        id="q"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by title or description..."
        className="pl-9"
        autoComplete="off"
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
      />

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-border/70 bg-card/90 shadow-lg backdrop-blur-xl">
          {suggestions.map((s, idx) => {
            const selected = idx === activeIndex;
            return (
              <button
                key={s.slug}
                type="button"
                className={[
                  "block w-full px-3 py-2 text-left text-sm transition-colors",
                  selected
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60",
                ].join(" ")}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applySuggestion(s.title)}
              >
                {s.title}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
