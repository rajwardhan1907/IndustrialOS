// Reusable search + sort hook for mobile list screens.
// Usage mirrors the web hook in components/useFilterSort.tsx.

import React, { useMemo, useState } from "react";
import { View, TextInput, Pressable, Text, StyleSheet } from "react-native";

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

// Simple bar: search input + horizontally-scrollable sort chips + direction toggle.
export function SearchSortBar({
  search,
  setSearch,
  sortBy,
  setSortBy,
  sortDir,
  setSortDir,
  sortOptions,
  placeholder = "Search…",
}: {
  search: string;
  setSearch: (s: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  sortDir: "asc" | "desc";
  setSortDir: (d: "asc" | "desc") => void;
  sortOptions: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <View style={s.wrap}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={placeholder}
        placeholderTextColor="#6b7385"
        style={s.input}
      />
      <View style={s.row}>
        {sortOptions.map((o) => {
          const active = o.value === sortBy;
          return (
            <Pressable key={o.value} onPress={() => setSortBy(o.value)} style={[s.chip, active && s.chipOn]}>
              <Text style={[s.chipText, active && s.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
          style={[s.chip, s.dirChip]}
        >
          <Text style={s.chipText}>{sortDir === "asc" ? "↑" : "↓"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 10 },
  input: {
    backgroundColor: "#0f1115",
    color: "#e5e7eb",
    borderColor: "#2a2f3a",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 8,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#0f1115",
    borderWidth: 1,
    borderColor: "#2a2f3a",
  },
  chipOn: { backgroundColor: "#1f2a44", borderColor: "#5b8de8" },
  chipText: { color: "#8a93a6", fontSize: 12, fontWeight: "600" },
  chipTextOn: { color: "#e5e7eb" },
  dirChip: { minWidth: 36, alignItems: "center" },
});
