import { getStore } from "@netlify/blobs";
import { parse } from "node-html-parser";

export interface IdeaItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: "producthunt" | "trustmrr" | "indiehackers";
  sourceLabel: string;
  mrr?: string;
  votes?: number;
  tags: string[];
  fetchedAt: string; // ISO date
  dateKey: string;   // YYYY-MM-DD
}

// ─── Product Hunt RSS ───────────────────────────────────────────────────────
async function fetchProductHunt(): Promise<IdeaItem[]> {
  try {
    const res = await fetch("https://www.producthunt.com/feed", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IdeaRadar/1.0)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const root = parse(xml);
    const items = root.querySelectorAll("item");
    const today = new Date().toISOString().slice(0, 10);

    return items.slice(0, 30).map((item) => {
      const title = item.querySelector("title")?.text?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ?? "";
      const desc = item.querySelector("description")?.text?.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]*>/g, "").trim().slice(0, 200) ?? "";
      const link = item.querySelector("link")?.text?.trim() ?? "";
      const pubDate = item.querySelector("pubDate")?.text?.trim() ?? "";
      const dateKey = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : today;

      return {
        id: `ph-${Buffer.from(link).toString("base64").slice(0, 16)}`,
        title,
        description: desc,
        url: link,
        source: "producthunt",
        sourceLabel: "Product Hunt",
        tags: ["新产品"],
        fetchedAt: new Date().toISOString(),
        dateKey,
      };
    });
  } catch (e) {
    console.error("ProductHunt fetch error:", e);
    return [];
  }
}

// ─── TrustMRR ───────────────────────────────────────────────────────────────
async function fetchTrustMRR(): Promise<IdeaItem[]> {
  try {
    const res = await fetch("https://trustmrr.com", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IdeaRadar/1.0)" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const root = parse(html);
    const today = new Date().toISOString().slice(0, 10);
    const results: IdeaItem[] = [];

    // 抓取产品卡片（根据实际 DOM 结构匹配）
    const cards = root.querySelectorAll("a[href*='/products/']");
    const seen = new Set<string>();

    for (const card of cards.slice(0, 30)) {
      const href = card.getAttribute("href") ?? "";
      if (!href || seen.has(href)) continue;
      seen.add(href);

      const title = card.querySelector("h2, h3, .font-bold, [class*='title']")?.text?.trim()
        ?? card.text?.trim().split("\n")[0]?.trim()
        ?? "";
      if (!title || title.length < 2) continue;

      const mrrEl = card.querySelector("[class*='mrr'], [class*='revenue'], span");
      const mrr = mrrEl?.text?.match(/\$[\d,.]+[KkMm]?\s*(MRR|mrr)?/)?.[0] ?? undefined;

      results.push({
        id: `tmrr-${Buffer.from(href).toString("base64").slice(0, 16)}`,
        title,
        description: `已验证 MRR 数据的真实创业产品`,
        url: href.startsWith("http") ? href : `https://trustmrr.com${href}`,
        source: "trustmrr",
        sourceLabel: "TrustMRR",
        mrr,
        tags: ["已验证MRR", "创业产品"],
        fetchedAt: new Date().toISOString(),
        dateKey: today,
      });
    }
    return results;
  } catch (e) {
    console.error("TrustMRR fetch error:", e);
    return [];
  }
}

// ─── IndieHackers ────────────────────────────────────────────────────────────
async function fetchIndieHackers(): Promise<IdeaItem[]> {
  try {
    // IndieHackers 产品列表页
    const res = await fetch("https://www.indiehackers.com/products?sorting=newest", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IdeaRadar/1.0)" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const root = parse(html);
    const today = new Date().toISOString().slice(0, 10);
    const results: IdeaItem[] = [];
    const seen = new Set<string>();

    // 抓产品链接
    const links = root.querySelectorAll("a[href*='/product/']");
    for (const a of links.slice(0, 20)) {
      const href = a.getAttribute("href") ?? "";
      if (!href || seen.has(href)) continue;
      seen.add(href);
      const title = a.text?.trim();
      if (!title || title.length < 2) continue;

      results.push({
        id: `ih-${Buffer.from(href).toString("base64").slice(0, 16)}`,
        title,
        description: "IndieHackers 独立开发者产品",
        url: href.startsWith("http") ? href : `https://www.indiehackers.com${href}`,
        source: "indiehackers",
        sourceLabel: "IndieHackers",
        tags: ["独立开发者", "Bootstrapped"],
        fetchedAt: new Date().toISOString(),
        dateKey: today,
      });
    }
    return results;
  } catch (e) {
    console.error("IndieHackers fetch error:", e);
    return [];
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export default async function handler() {
  console.log("[scrape-daily] Starting scrape:", new Date().toISOString());

  const [phItems, tmrrItems, ihItems] = await Promise.all([
    fetchProductHunt(),
    fetchTrustMRR(),
    fetchIndieHackers(),
  ]);

  const allItems = [...phItems, ...tmrrItems, ...ihItems];
  console.log(`[scrape-daily] Fetched: PH=${phItems.length}, TMRR=${tmrrItems.length}, IH=${ihItems.length}`);

  // 读取已有数据，合并去重
  const store = getStore("idea-radar");
  let existing: IdeaItem[] = [];
  try {
    const raw = await store.get("all-ideas", { type: "json" });
    if (Array.isArray(raw)) existing = raw;
  } catch (_) {}

  const existingIds = new Set(existing.map((i) => i.id));
  const newItems = allItems.filter((i) => !existingIds.has(i.id));
  const merged = [...newItems, ...existing].slice(0, 2000); // 最多保留 2000 条

  await store.setJSON("all-ideas", merged);
  console.log(`[scrape-daily] Saved ${merged.length} total items (${newItems.length} new)`);

  return new Response(JSON.stringify({ success: true, newItems: newItems.length, total: merged.length }), {
    headers: { "Content-Type": "application/json" },
  });
}
