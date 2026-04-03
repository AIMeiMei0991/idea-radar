// 每日抓取脚本 - 运行于 GitHub Actions
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../public/data/ideas.json');

// ─── 评分系统 ──────────────────────────────────────────────────────────────
const HIGH_KEYWORDS = ['ai', 'automation', 'saas', 'creator', 'marketing', 'analytics', 'video', 'schedule', 'content', 'agent'];
const CHINA_KEYWORDS = ['creator', 'video', 'content', 'social', 'marketing', 'ecommerce', 'schedule', 'seo', 'analytics'];
const LOW_KEYWORDS = ['game', 'dating', 'nft', 'crypto', 'gambling'];

const CATEGORIES = {
  'ai': 'AI工具', 'video': '视频创作', 'marketing': '营销增长',
  'saas': 'SaaS工具', 'content': '内容创作', 'analytics': '数据分析',
  'ecommerce': '电商工具', 'productivity': '效率工具', 'education': '教育学习',
  'health': '健康生活', 'finance': '财务工具',
};

function detectCategory(text) {
  const t = text.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORIES)) {
    if (t.includes(k)) return v;
  }
  return '数字工具';
}

function scoreItem(title, desc, mrr) {
  const text = (title + ' ' + (desc || '')).toLowerCase();
  let score = 2;
  const reasons = [];
  if (mrr) { score += 2; reasons.push(`已验证收入 ${mrr}`); }
  if (HIGH_KEYWORDS.some(k => text.includes(k))) { score += 1; reasons.push('热门赛道'); }
  if (LOW_KEYWORDS.some(k => text.includes(k))) { score -= 2; reasons.push('中国受限'); }
  if (CHINA_KEYWORDS.filter(k => text.includes(k)).length >= 2) { score += 1; reasons.push('适配中国'); }
  return { score: Math.max(1, Math.min(5, score)), reason: reasons.join(' · ') || '基础工具' };
}

function generateInsight(title, desc) {
  const text = (title + ' ' + (desc || '')).toLowerCase();
  if (text.includes('ai') && text.includes('video')) return { summary: 'AI自动生成视频，解决批量产出难题', opportunity: '抖音/小红书投流素材强需求，国内无成熟竞品' };
  if (text.includes('schedule') || text.includes('social media')) return { summary: '社交媒体排期与自动发布，节省运营时间', opportunity: '小红书/抖音运营者强需求，本土化工具几乎空白' };
  if (text.includes('seo')) return { summary: 'AI辅助内容创作和SEO优化，降低获客成本', opportunity: '百度SEO+小红书SEO，国内工具落后2年' };
  if (text.includes('email') || text.includes('outreach')) return { summary: '自动化外联工具，提升B2B销售效率', opportunity: '跨境出海企业获客痛点，信息差大' };
  if (text.includes('analytics') || text.includes('attribution')) return { summary: '广告归因和数据分析，精准优化ROI', opportunity: '国内投流市场缺乏独立归因工具' };
  if (text.includes('creator') || text.includes('monetiz')) return { summary: '创作者变现工具，降低平台依赖', opportunity: '中国创作者经济爆发，独立变现工具稀缺' };
  if (text.includes('resume')) return { summary: 'AI简历优化，提升求职成功率', opportunity: '国内已有竞品但AI能力弱，差异化空间大' };
  if (text.includes('agent')) return { summary: 'AI Agent自动化工作流，替代重复性任务', opportunity: '国内企业数字化升级需求爆发' };
  return { summary: desc ? desc.slice(0, 80) : '新兴数字工具，解决垂直领域需求', opportunity: '评估中国市场适配性' };
}

// ─── Product Hunt RSS (Atom) ──────────────────────────────────────────────
async function fetchProductHunt() {
  try {
    const res = await fetch('https://www.producthunt.com/feed', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IdeaRadar/1.0)' }
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.split('<entry>').slice(1);
    const results = [];

    for (const entry of entries.slice(0, 25)) {
      const title = (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').trim();
      const url = entry.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/)?.[1]?.trim() || '';
      if (!title || !url) continue;

      const rawDesc = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] || '';
      const desc = rawDesc
        .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
        .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0, 200);

      const pubDate = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() || '';
      const dateKey = pubDate ? new Date(pubDate).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);

      const { score, reason } = scoreItem(title, desc);
      const { summary, opportunity } = generateInsight(title, desc);
      const id = Buffer.from(url).toString('base64').slice(0, 16);

      results.push({
        id: `ph-${id}`, title, summary, opportunity, score, scoreReason: reason,
        url, source: 'producthunt', sourceLabel: 'Product Hunt',
        category: detectCategory(title + ' ' + desc),
        tags: ['新产品'], fetchedAt: new Date().toISOString(), dateKey,
      });
    }
    console.log(`[PH] ${results.length} 条`);
    return results;
  } catch (e) { console.error('PH error:', e.message); return []; }
}

// ─── TrustMRR ──────────────────────────────────────────────────────────────
async function fetchTrustMRR() {
  try {
    const res = await fetch('https://trustmrr.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IdeaRadar/1.0)' }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const today = new Date().toISOString().slice(0, 10);
    const results = [];
    const seen = new Set();
    const regex = /href="(\/startup\/[^"?#]+)"/g;
    let m;

    while ((m = regex.exec(html)) !== null) {
      const path = m[1];
      if (seen.has(path)) continue;
      seen.add(path);

      const slug = path.replace('/startup/', '');
      const title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      const idx = html.indexOf(`"${path}"`);
      const nearby = html.slice(Math.max(0, idx - 500), idx + 500);
      const mrr = nearby.match(/\$[\d,]+(\.\d+)?[KkMm]?\s*(?:MRR|mrr)/)?.[0]?.trim();

      const { score, reason } = scoreItem(title, '', mrr);
      const { summary, opportunity } = generateInsight(title, mrr ? `月收入 ${mrr}` : '');

      results.push({
        id: `tmrr-${Buffer.from(path).toString('base64').slice(0,16)}`,
        title, summary, opportunity, score, scoreReason: reason,
        url: `https://trustmrr.com${path}`,
        source: 'trustmrr', sourceLabel: 'TrustMRR',
        mrr, category: detectCategory(title),
        tags: ['已验证收入'], fetchedAt: new Date().toISOString(), dateKey: today,
      });
    }
    console.log(`[TMRR] ${results.length} 条`);
    return results.slice(0, 25);
  } catch (e) { console.error('TMRR error:', e.message); return []; }
}

// ─── IndieHackers ──────────────────────────────────────────────────────────
async function fetchIndieHackers() {
  try {
    const res = await fetch('https://www.indiehackers.com/products?sorting=newest', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IdeaRadar/1.0)' }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const today = new Date().toISOString().slice(0, 10);
    const results = [];
    const seen = new Set();
    const regex = /href="(\/product\/[^"?#]+)"/g;
    let m;

    while ((m = regex.exec(html)) !== null) {
      const path = m[1];
      if (seen.has(path)) continue;
      seen.add(path);

      const slug = path.replace('/product/', '');
      const title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const { score, reason } = scoreItem(title, '');
      const { summary, opportunity } = generateInsight(title, '');

      results.push({
        id: `ih-${Buffer.from(path).toString('base64').slice(0,16)}`,
        title, summary, opportunity, score, scoreReason: reason,
        url: `https://www.indiehackers.com${path}`,
        source: 'indiehackers', sourceLabel: 'IndieHackers',
        category: detectCategory(title),
        tags: ['独立开发者'], fetchedAt: new Date().toISOString(), dateKey: today,
      });
    }
    console.log(`[IH] ${results.length} 条`);
    return results.slice(0, 25);
  } catch (e) { console.error('IH error:', e.message); return []; }
}

// ─── Main ──────────────────────────────────────────────────────────────────
(async () => {
  console.log('开始抓取:', new Date().toISOString());
  const [ph, tmrr, ih] = await Promise.all([fetchProductHunt(), fetchTrustMRR(), fetchIndieHackers()]);
  const newItems = [...ph, ...tmrr, ...ih];
  console.log(`新抓取: ${newItems.length} 条`);

  // 读取已有数据
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (_) {}

  // 去重合并，最多保留 1000 条
  const existingIds = new Set(existing.map(i => i.id));
  const merged = [...newItems.filter(i => !existingIds.has(i.id)), ...existing].slice(0, 1000);

  fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2));
  console.log(`保存完成: 共 ${merged.length} 条`);
})();
