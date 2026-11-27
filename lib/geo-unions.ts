// Unions per upazila (4,540 rows). Server-only: kept out of the page bundle
// and served per upazila by app/api/geo/unions/[upazila]/route.ts.
import unions from "@/data/bd-geo/unions.json";

export type Union = { id: number; bn: string; en: string };

const BY_UPAZILA = unions as unknown as Record<string, [number, string, string][]>;

export function unionsOf(upazilaId: number): Union[] {
  return (BY_UPAZILA[String(upazilaId)] ?? []).map(([id, bn, en]) => ({ id, bn, en })).sort((a, b) => a.bn.localeCompare(b.bn, "bn"));
}

export function findUnion(upazilaId: number, unionId: number): Union | undefined {
  return unionsOf(upazilaId).find((u) => u.id === unionId);
}
