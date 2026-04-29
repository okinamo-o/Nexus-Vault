"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  currentSort: string;
  requireSpecs: boolean;
  requireMirrors: boolean;
};

export function HomeSearchFilters({
  currentSort,
  requireSpecs,
  requireMirrors,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sort, setSort] = React.useState(currentSort);
  const [req, setReq] = React.useState(requireSpecs);
  const [mirrors, setMirrors] = React.useState(requireMirrors);

  React.useEffect(() => {
    setSort(currentSort);
    setReq(requireSpecs);
    setMirrors(requireMirrors);
  }, [currentSort, requireSpecs, requireMirrors]);

  function pushNextParams(next: { sort?: string; req?: boolean; mirrors?: boolean }) {
    const params = new URLSearchParams();
    const q = searchParams.get("q")?.trim() ?? "";
    if (q) params.set("q", q);

    const nextSort = next.sort ?? sort;
    params.set("sort", nextSort);

    const nextReq = next.req ?? req;
    if (nextReq) params.set("req", "1");

    const nextMirrors = next.mirrors ?? mirrors;
    if (nextMirrors) params.set("mirrors", "1");

    router.replace(`/?${params.toString()}`);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <select
        name="sort"
        value={sort}
        onChange={(e) => {
          const nextSort = e.target.value;
          setSort(nextSort);
          pushNextParams({ sort: nextSort });
        }}
        className="h-11 rounded-xl border border-input/80 bg-background/55 px-3 text-sm text-foreground"
      >
        <option value="newest">Sort: Newest</option>
        <option value="updated">Sort: Recently Updated</option>
        <option value="mirrors">Sort: Most Mirrors</option>
        <option value="az">Sort: A-Z</option>
      </select>

      <label className="flex items-center gap-2 rounded-xl border border-input/70 bg-background/45 px-3 text-sm">
        <input
          type="checkbox"
          name="req"
          value="1"
          checked={req}
          onChange={(e) => {
            const nextReq = e.target.checked;
            setReq(nextReq);
            pushNextParams({ req: nextReq });
          }}
        />
        Specs only
      </label>

      <label className="flex items-center gap-2 rounded-xl border border-input/70 bg-background/45 px-3 text-sm">
        <input
          type="checkbox"
          name="mirrors"
          value="1"
          checked={mirrors}
          onChange={(e) => {
            const nextMirrors = e.target.checked;
            setMirrors(nextMirrors);
            pushNextParams({ mirrors: nextMirrors });
          }}
        />
        Mirrors only
      </label>
    </div>
  );
}

