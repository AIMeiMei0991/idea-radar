import { getStore } from "@netlify/blobs";
import { NextResponse } from "next/server";
import type { IdeaItem } from "../../../netlify/functions/scrape-daily.mts";

export const runtime = "edge";
export const revalidate = 3600; // 1 hour cache

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source"); // filter by source
  const q = searchParams.get("q")?.toLowerCase(); // search query
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = 30;

  try {
    const store = getStore("idea-radar");
    const raw = await store.get("all-ideas", { type: "json" }) as IdeaItem[] | null;
    let items: IdeaItem[] = Array.isArray(raw) ? raw : [];

    // 过滤
    if (source) items = items.filter((i) => i.source === source);
    if (q) items = items.filter((i) =>
      i.title.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q))
    );

    // 按日期排序（最新在前）
    items.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    const total = items.length;
    const paginated = items.slice((page - 1) * pageSize, page * pageSize);

    // 按 dateKey 分组
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
