"use client";
// Reusable search + sort hook for list/table tabs.
// Usage:
//   const { search, setSearch, sortBy, setSortBy, sortDir, setSortDir, filtered } =
//     useFilterSort(items, {
//       searchFields: (i) => [i.customer, i.sku],
//       sortOptions: [
//         { value: "date",     label: "Date",     get: (i) => i.createdAt },
//         { value: "customer", label: "Customer", get: (i) => i.customer },
//         { value: "value",    label: "Value",    get: (i) => i.value },
//       ],
//       defaultSort: "date",
//       defaultDir: "desc",
//     });
//   <SearchSortBar ... />
//   {filtered.map(...)}

import { useMemo, useState } from "react";

export type SortOption<T> = {
  value: string;
  label: string;
  get: (item: T) => any;
};

export type UseFilterSortOpts<T> = {
  searchFields: (item: T) => Array<string | number | null | undefined>;
  sortOptions: SortOption<T>[];
  defaultSort?: string;
  defaultDir?: "asc" | "desc";
};

export function useFilterSort<T>(items: T[], opts: UseFilterSortOpts<T>) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>(opts.defaultSort ?? opts.sortOptions[0]?.value ?? "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(opts.defaultDir ?? "desc");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const option = opts.sortOptions.find((o) => o.value === sortBy) ?? opts.sortOptions[0];
    const list = needle
      ? items.filter((item) => {
          const hay = opts
            .searchFields(item)
            .filter((v) => v !== null && v !== undefined)
            .join(" ")
            .toLowerCase();
          return hay.includes(needle);
        })
      : items.slice();
    if (!option) return list;
    return list.sort((a, b) => {
      const va = option.get(a);
      const vb = option.get(b);
      // Nulls last for asc, first for desc
      if (va == null && vb == null) return 0;
      if (va == null) return sortDir === "asc" ? 1 : -1;
      if (vb == null) return sortDir === "asc" ? -1 : 1;
      if (va === vb) return 0;
      const cmp = va > vb ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, sortBy, sortDir]);

  return { search, setSearch, sortBy, setSortBy, sortDir, setSortDir, filtered };
}

// Matching bar component — search input + sort dropdown + direction toggle.
export function SearchSortBar({
  search,
  setSearch,
  sortBy,
  setSortBy,
  sortDir,
  setSortDir,
  sortOptions,
  placeholder = "Search…",
  style,
}: {
  search: string;
  setSearch: (s: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  sortDir: "asc" | "desc";
  setSortDir: (d: "asc" | "desc") => void;
  sortOptions: { value: string; label: string }[];
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 12,
        flexWrap: "wrap",
        ...style,
      }}
    >
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: "1 1 200px",
          minWidth: 180,
          padding: "8px 10px",
          background: "#0f1115",
          color: "#e5e7eb",
          border: "1px solid #2a2f3a",
          borderRadius: 8,
          fontSize: 13,
          outline: "none",
        }}
      />
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        style={{
          padding: "8px 10px",
          background: "#0f1115",
          color: "#e5e7eb",
          border: "1px solid #2a2f3a",
          borderRadius: 8,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            Sort: {o.label}
          </option>
        ))}
      </select>
      <button
        onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
        title={sortDir === "asc" ? "Ascending" : "Descending"}
        style={{
          padding: "8px 12px",
          background: "#0f1115",
          color: "#e5e7eb",
          border: "1px solid #2a2f3a",
          borderRadius: 8,
          fontSize: 13,
          cursor: "pointer",
          minWidth: 44,
        }}
      >
        {sortDir === "asc" ? "↑" : "↓"}
      </button>
    </div>
  );
}
