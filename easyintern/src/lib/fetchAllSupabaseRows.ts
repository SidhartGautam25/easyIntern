import type { SupabaseClient } from "@supabase/supabase-js";

/** Paginate past PostgREST max-rows (often 1000) to load full history. */
export async function fetchAllSupabaseRows<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  options?: {
    select?: string;
    orderBy?: string;
    ascending?: boolean;
    pageSize?: number;
  }
): Promise<T[]> {
  const select = options?.select ?? "*";
  const orderBy = options?.orderBy ?? "created_at";
  const ascending = options?.ascending ?? false;
  const pageSize = options?.pageSize ?? 1000;

  const all: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderBy, { ascending })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const batch = (data || []) as T[];
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all;
}
