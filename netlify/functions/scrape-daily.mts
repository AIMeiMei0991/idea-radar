import { getStore } from "@netlify/blobs";

export interface IdeaItem {
  id: string;
  title: string;
  titleZh: string;
  summary: string;         // 中文核心论点
  opportunity: string;     // 中国市场机会
  score: number;           // 价值评分 1-5
  scoreReason: string;     // 评分理由
  url: string;
  source: "producthunt" | "trustmrr" | "indiehackers";
  sourceLabel: string;
  mrr?: string;
  tags: string[];
  category: string;
  fetchedAt: string;
  dateKey: string;
}

// ─── 关键词评分系统 ────────────────────────────────────────────────────────
const HIGH_VALUE_KEYWORDS = ["ai", "automation", "saas", "creator", "marketing", "analytics", "video", "schedule", "content", "tool", "agent"];
const CHINA_KEYWORDS = ["creator", "video", "content", "social", "marketing", "ecommerce", "schedule", "email", "seo", "analytics"];
const LOW_VALUE_KEYWORDS = ["game", "fun", "pet", "dating", "nft", "crypto", "blockchain"];

const CATEGORY_MAP: Record<string, string> = {
  ai: "AI工具", video: "视频创作", marketing: "营销增长", saas: "SaaS工具",
  content: "内容创作", analytics: "数据分析", ecommerce: "电商工具",
  productivity: "效率工具", education: "教育学习", health: "健康生活",
  finance: "财务工具", developer: "开发者工具",
};

function detectCategory(text: string): string {
  const t = text.toLowerCase();
  for (const [key, label] of Object.entries(CATEGORY_MAP)) {
    if (t.includes(key)) return label;
  }
  return "数字工具";
}

function scoreItem(title: string, desc: string, mrr?: string): { score: number; reason: string } {
  const text = (title + " " + desc).toLowerCase();
  let score = 2;
  const reasons: string[] = [];

  if (mrr) { score += 2; reasons.push(`已有真实收入 ${mrr}`); }
  if (HIGH_VALUE_KEYWORDS.some(k => text.includes(k))) { score += 1; reasons.push("高需求赛道"); }
  if (LOW_VALUE_KEYWORDS.some(k => text.includes(k))) { score -= 2; reasons.push("中国市场受限"); }
  if (CHINA_KEYWORDS.filter(k => text.includes(k)).length >= 2) { score += 1; reasons.push("适合中国市场"); }

  score = Math.max(1, Math.min(5, score));
  return { score, reason: reasons.join(" · ") || "基础工具方向" };
}

function generateSummary(title: string, desc: string, source: string): { titleZh: string; summary: string; opportunity: string } {
  const text = (title + " " + desc).toLowerCase();

  // 中文标题（简化翻译逻辑）
  const titleZh = title; // 保留英文，前端展示时标注

  // 核心论点生成
  let summary = "";
  let opportunity = "";

  if (text.includes("ai") && text.includes("video")) {
    summary = "AI自动生成视频内容，解决创作者批量产出难题";
    opportunity = "抖音/小红书投流素材需求爆发，国内无成熟竞品";
  } else if (text.includes("schedule") || text.includes("social media")) {
    summary = "社交媒体内容排期与自动发布，节省运营时间";
    opportunity = "小红书/抖音运营者强需求，本土化版本几乎空白";
  } else if (text.includes("seo") || text.includes("content") && text.includes("ai")) {
    summary = "AI辅助内容创作和搜索优化，降低获客成本";
    opportunity = "百度SEO+小红书SEO工具市场，国内工具落后2年";
  } else if (text.includes("email") || text.includes("outreach")) {
    summary = "自动化邮件/外联工具，提升销售效率";
    opportunity = "跨境出海企业B2B获客痛点，信息差大";
  } else if (text.includes("analytics") || text.includes("attribution")) {
    summary = "广告效果归因和数据分析，精准优化ROI";
    opportunity = "国内投流市场缺乏独立分析工具";
  } else if (text.includes("creator") || text.includes("monetiz")) {
    summary = "创作者变现和商业化工具，降低平台依赖";
    opportunity = "中国创作者经济爆发，独立变现工具稀缺";
  } else if (text.includes("resume") || text.includes("job")) {
    summary = "AI简历优化，提升求职成功率";
    opportunity = "国内已有竞品但AI能力弱，可差异化切入";
  } else if (source === "trustmrr") {
    summary = `真实验证的商业模式，${desc}`;
    opportunity = "海外已验证收入，国内可复刻";
  } else {
    summary = desc.slice(0, 80) || "新兴数字工具，解决特定垂直需求";
    opportunity = "评估中国市场适配性";
  }

  return { titleZh, summary, opportunity };
}

// ─── Product Hunt (Atom) ──────────────────────────────────────────────────────
async function fetchProductHunt(): Promise<IdeaItem[]> {
  try {
    const res = await fetch("https://www.producthunt.com/feed", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IdeaRadar/1.0)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.split("<entry>").slice(1);
    const results: IdeaItem[] = [];

    for (const entry of entries.slice(0, 25)) {
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = entry.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/);
      const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/);
      const pubMatch = entry.match(/<published>([\s\S]*?)<\/published>/);

      const title = titleMatch?.[1]?.trim() ?? "";
      const url = linkMatch?.[1]?.trim() ?? "";
      if (!title || !url) continue;

      const rawDesc = contentMatch?.[1] ?? "";
      const desc = rawDesc
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);

      const pubDate = pubMatch?.[1]?.trim() ?? "";
      const dateKey = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      const { score, reason } = scoreItem(title, desc);
      const { titleZh, summary, opportunity } = generateSummary(title, desc, "producthunt");

      results.push({
        id: `ph-${Buffer.from(url).toString("base64").slice(0, 16)}`,
        title, titleZh, summary, opportunity,
        score, scoreReason: reason,
        url, source: "producthunt", sourceLabel: "Product Hunt",
        category: detectCategory(title + " " + desc),
        tags: ["新产品"],
        fetchedAt: new Date().toISOString(), dateKey,
      });
    }
    console.log(`[PH] ${results.length} 条`);
    return results;
  } catch (e) { console.error("PH error:", e); return []; }
}

// ─── TrustMRR ────────────────────────────────────────────────────────────────
async function fetchTrustMRR(): Promise<IdeaItem[]> {
  try {
    const res = await fetch("https://trustmrr.com", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IdeaRadar/1.0)" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const today = new Date().toISOString().slice(0, 10);
    const results: IdeaItem[] = [];
    const seen = new Set<string>();
    const linkRegex = /href="(\/startup\/[^"?#]+)"/g;
    let m: RegExpExecArray | null;

    while ((m = linkRegex.exec(html)) !== null) {
      const path = m[1];
      if (seen.has(path)) continue;
      seen.add(path);

      const slug = path.replace("/startup/", "");
      const title = slug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

      const idx = html.indexOf(`"${path}"`);
      const nearby = html.slice(Math.max(0, idx - 500), idx + 500);
      const mrrMatch = nearby.match(/\$[\d,]+(\.\d+)?[KkMm]?\s*(?:MRR|mrr)/);
      const mrr = mrrMatch?.[0]?.trim();

      const { score, reason } = scoreItem(title, "", mrr);
      const { titleZh, summary, opportunity } = generateSummary(title, mrr ? `月收入 ${mrr}` : "", "trustmrr");

      results.push({
        id: `tmrr-${Buffer.from(path).toString("base64").slice(0, 16)}`,
        title, titleZh, summary, opportunity,
        score, scoreReason: reason,
        url: `https://trustmrr.com${path}`,
        source: "trustmrr", sourceLabel: "TrustMRR",
        mrr, category: detectCategory(title),
        tags: ["已验证收入"],
        fetchedAt: new Date().toISOString(), dateKey: today,
      });
    }
    console.log(`[TMRR] ${results.length} 条`);
    return results.slice(0, 25);
  } catch (e) { console.error("TMRR error:", e); return []; }
}

// ─── IndieHackers ─────────────────────────────────────────────────────────────
async function fetchIndieHackers(): Promise<IdeaItem[]> {
  try {
    const res = await fetch("https://www.indiehackers.com/products?sorting=newest", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IdeaRadar/1.0)" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const today = new Date().toISOString().slice(0, 10);
    const results: IdeaItem[] = [];
    const seen = new Set<string>();
    const linkRegex = /href="(\/product\/[^"?#]+)"/g;
    let m: RegExpExecArray | null;

    while ((m = linkRegex.exec(html)) !== null) {
      const path = m[1];
      if (seen.has(path)) continue;
      seen.add(path);

      const slug = path.replace("/product/", "");
      const title = slug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

      const idx = html.indexOf(`"${path}"`);
      const nearby = html.slice(Math.max(0, idx - 200), idx + 200);
      const revenueMatch = nearby.match(/\$[\d,]+[KkMm]?\s*\/\s*mo/);

      const { score, reason } = scoreItem(title, "", revenueMatch?.[0]);
      const { titleZh, summary, opportunity } = generateSummary(title, "", "indiehackers");

      results.push({
        id: `ih-${Buffer.from(path).toString("base64").slice(0, 16)}`,
        title, titleZh, summary, opportunity,
        score, scoreReason: reason,
        url: `https://www.indiehackers.com${path}`,
        source: "indiehackers", sourceLabel: "IndieHackers",
        mrr: revenueMatch?.[0],
        category: detectCategory(title),
        tags: ["独立开发者"],
        fetchedAt: new Date().toISOString(), dateKey: today,
      });
    }
    console.log(`[IH] ${results.length} 条`);
    return results.slice(0, 25);
  } catch (e) { console.error("IH error:", e); return []; }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default async function handler() {
  const [ph, tmrr, ih] = await Promise.all([fetchProductHunt(), fetchTrustMRR(), fetchIndieHackers()]);
  const allItems = [...ph, ...tmrr, ...ih];

  const store = getStore("idea-radar");
  let existing: IdeaItem[] = [];
  try {
    const raw = await store.get("all-ideas", { type: "json" });
    if (Array.isArray(raw)) existing = raw;
  } catch (_) {}

  const existingIds = new Set(existing.map((i) => i.id));
  const newItems = allItems.filter((i) => !existingIds.has(i.id));
  const merged = [...newItems, ...existing].slice(0, 3000);
  await store.setJSON("all-ideas", merged);

  return new Response(
    JSON.stringify({ success: true, newItems: newItems.length, total: merged.length }),
    { headers: { "Content-Type": "application/json" } }
  );
}
