import { getStore } from "@netlify/blobs";
import { NextResponse } from "next/server";
import type { IdeaItem } from "../../../netlify/functions/scrape-daily.mts";

export const runtime = "edge";
export const revalidate = 1800;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const q = searchParams.get("q")?.toLowerCase();
  const minScore = parseInt(searchParams.get("minScore") ?? "0");
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = 30;

  try {
    const store = getStore("idea-radar");
    const raw = await store.get("all-ideas", { type: "json" }) as IdeaItem[] | null;
    let items: IdeaItem[] = Array.isArray(raw) ? raw : [];

    if (source) items = items.filter((i) => i.source === source);
    if (minScore > 0) items = items.filter((i) => i.score >= minScore);
    if (q) items = items.filter((i) =>
      i.title.toLowerCase().includes(q) ||
      i.summary?.toLowerCase().includes(q) ||
      i.opportunity?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q))
    );

    // 按日期排序，同日期内按评分排序
    items.sort((a, b) => {
      const dateDiff = b.dateKey.localeCompare(a.dateKey);
      if (dateDiff !== 0) return dateDiff;
      return b.score - a.score;
    });

    const total = items.length;
    const paginated = items.slice((page - 1) * pageSize, page * pageSize);

    const grouped: Record<string, IdeaItem[]> = {};
    for (const item of paginated) {
      if (!grouped[item.dateKey]) grouped[item.dateKey] = [];
      grouped[item.dateKey].push(item);
    }

    return NextResponse.json({ grouped, total, page, pageSize });
  } catch (e) {
    console.error("API error:", e);
    return NextResponse.json({ grouped: {}, total: 0, page: 1, pageSize }, { status: 500 });
  }
}
