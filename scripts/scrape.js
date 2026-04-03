// 每日抓取脚本 - 运行于 GitHub Actions
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../public/data/ideas.json');

// ─── 标题修正 ──────────────────────────────────────────────────────────────
function fixTitle(t) {
  return t
    .replace(/\bAi\b/g,'AI').replace(/\bSaas\b/g,'SaaS').replace(/\bMrr\b/g,'MRR')
    .replace(/\bArr\b/g,'ARR').replace(/\bSeo\b/g,'SEO').replace(/\bApi\b/g,'API')
    .replace(/\bCrm\b/g,'CRM').replace(/\bUgc\b/g,'UGC').replace(/\bB2b\b/g,'B2B')
    .replace(/\bB2c\b/g,'B2C').replace(/\bUi\b/g,'UI').replace(/\bUx\b/g,'UX')
    .replace(/\bIo\b/g,'IO').replace(/\bPdf\b/g,'PDF').replace(/\bCsv\b/g,'CSV');
}

// ─── 评分系统 ──────────────────────────────────────────────────────────────
const HIGH_KEYWORDS = ['ai', 'automation', 'saas', 'creator', 'marketing', 'analytics', 'video', 'schedule', 'content', 'agent', 'tool'];
const CHINA_KEYWORDS = ['creator', 'video', 'content', 'social', 'marketing', 'ecommerce', 'schedule', 'seo', 'analytics', 'email'];
const LOW_KEYWORDS = ['game', 'dating', 'nft', 'crypto', 'gambling', 'blockchain'];

const CATEGORIES = {
  'ai': 'AI工具', 'video': '视频创作', 'marketing': '营销增长',
  'saas': 'SaaS工具', 'content': '内容创作', 'analytics': '数据分析',
  'ecommerce': '电商工具', 'productivity': '效率工具', 'education': '教育学习',
  'health': '健康生活', 'finance': '财务工具', 'developer': '开发者工具',
  'design': '设计工具', 'hr': 'HR工具', 'crm': '客户管理',
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
  if (CHINA_KEYWORDS.filter(k => text.includes(k)).length >= 2) { score += 1; reasons.push('适配中国市场'); }
  return { score: Math.max(1, Math.min(5, score)), reason: reasons.join(' · ') || '基础工具' };
}

// ─── 中文摘要生成（修复运算符优先级 + 增加多样性）──────────────────────────
function generateInsight(title, desc) {
  const text = (title + ' ' + (desc || '')).toLowerCase();

  // 注意：用括号明确优先级，避免 || 和 && 的混淆
  if (text.includes('ai') && text.includes('video'))
    return { summary: `AI自动生成视频内容，解决创作者批量产出的效率瓶颈`, opportunity: '抖音/小红书投流素材需求爆发，国内无成熟 AI 视频素材工具' };

  if (text.includes('ai') && (text.includes('content') || text.includes('write') || text.includes('copy')))
    return { summary: `AI辅助内容生产，降低文案和图文创作成本`, opportunity: '品牌自媒体运营需求旺盛，国内工具缺少垂直行业版本' };

  if (text.includes('ai') && text.includes('seo'))
    return { summary: `AI 驱动的 SEO 内容优化，自动提升搜索排名`, opportunity: '百度 SEO + 小红书 SEO 工具市场，国内独立工具落后海外约 2 年' };

  if (text.includes('schedule') || text.includes('social media'))
    return { summary: `社交媒体内容排期与自动发布，降低运营重复劳动`, opportunity: '小红书/抖音/微信多平台运营工具几乎空白，MCN 机构强需求' };

  if (text.includes('email') && text.includes('outreach'))
    return { summary: `冷邮件自动化外联，提升 B2B 销售触达效率`, opportunity: '中国出海企业开拓海外市场的核心痛点，工具信息差显著' };

  if (text.includes('email'))
    return { summary: `邮件营销自动化，通过精准触达提升转化率`, opportunity: '跨境独立站卖家和 SaaS 企业的高频需求，ROI 可量化' };

  if (text.includes('analytics') || text.includes('attribution'))
    return { summary: `广告归因和数据可视化，精准衡量每一分投放的效果`, opportunity: '国内投流市场规模庞大，独立第三方归因工具稀缺' };

  if (text.includes('creator') || text.includes('monetiz'))
    return { summary: `帮助创作者独立变现，减少对平台抽成的依赖`, opportunity: '中国创作者经济规模超 5000 亿，独立变现工具生态待建' };

  if (text.includes('agent') || text.includes('automation'))
    return { summary: `AI Agent 自动接管重复性工作流，解放人力`, opportunity: '企业降本增效需求迫切，AI 替代白领工作是未来 3 年最大红利' };

  if (text.includes('resume') || text.includes('job') || text.includes('hiring'))
    return { summary: `AI 简历优化和招聘匹配，提升求职/招聘效率`, opportunity: '国内招聘市场竞争激烈，AI 简历工具付费意愿强' };

  if (text.includes('health') || text.includes('sleep') || text.includes('wellness'))
    return { summary: `通过数据追踪和 AI 建议改善个人健康状态`, opportunity: '中国健康管理 APP 市场规模千亿，但 AI 个性化能力弱' };

  if (text.includes('finance') || text.includes('invoice') || text.includes('accounting'))
    return { summary: `自动化财务管理，帮助中小企业和自由职业者省时省力`, opportunity: '国内个体工商户和自由职业者财税工具市场增速迅猛' };

  if (text.includes('design') || text.includes('ui') || text.includes('template'))
    return { summary: `降低设计门槛，让非设计师也能快速出图`, opportunity: '电商/自媒体/教育行业对设计工具需求大，国内 Canva 类产品未完全覆盖' };

  if (text.includes('ecommerce') || text.includes('shopify') || text.includes('amazon'))
    return { summary: `跨境电商卖家的运营效率工具，降低选品和投放成本`, opportunity: '中国有全球最大跨境电商卖家群体，工具需求持续扩大' };

  if (desc && desc.length > 20)
    return { summary: desc.slice(0, 80).trim() + (desc.length > 80 ? '…' : ''), opportunity: '关注此赛道在中国的本土化机会' };

  return { summary: '新兴数字工具，聚焦垂直领域效率提升', opportunity: '可评估国内同类需求规模和信息差空间' };
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

      results.push({
        id: `ph-${Buffer.from(url).toString('base64').slice(0,16)}`,
        title: fixTitle(title), summary, opportunity, score, scoreReason: reason,
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
      const p = m[1];
      if (seen.has(p)) continue;
      seen.add(p);

      const slug = p.replace('/startup/', '');
      const rawTitle = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const title = fixTitle(rawTitle);

      const idx = html.indexOf(`"${p}"`);
      const nearby = html.slice(Math.max(0, idx-500), idx+500);
      const mrr = nearby.match(/\$[\d,]+(\.\d+)?[KkMm]?\s*(?:MRR|mrr)/)?.[0]?.trim();
      const { score, reason } = scoreItem(title, '', mrr);
      const { summary, opportunity } = generateInsight(title, mrr ? `月收入 ${mrr}` : '');

      results.push({
        id: `tmrr-${Buffer.from(p).toString('base64').slice(0,16)}`,
        title, summary, opportunity, score, scoreReason: reason,
        url: `https://trustmrr.com${p}`,
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
      const p = m[1];
      if (seen.has(p)) continue;
      seen.add(p);

      const slug = p.replace('/product/', '');
      const rawTitle = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const title = fixTitle(rawTitle);
      const { score, reason } = scoreItem(title, '');
      const { summary, opportunity } = generateInsight(title, '');

      results.push({
        id: `ih-${Buffer.from(p).toString('base64').slice(0,16)}`,
        title, summary, opportunity, score, scoreReason: reason,
        url: `https://www.indiehackers.com${p}`,
        source: 'indiehackers', sourceLabel: 'IndieHackers',
        category: detectCategory(title),
        tags: ['独立开发者'], fetchedAt: new Date().toISOString(), dateKey: today,
      });
    }
    console.log(`[IH] ${results.length} 条`);
    return results.slice(0, 25);
  } catch (e) { console.error('IH error:', e.message); return []; }
}

// ─── Hacker News (官方 API，过滤创业/工具相关) ────────────────────────────
async function fetchHackerNews() {
  try {
    // 抓 Show HN + Ask HN 精选，用官方 Firebase API
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!res.ok) return [];
    const ids = await res.json();
    const today = new Date().toISOString().slice(0, 10);

    // 关键词：只保留与创业/工具/SaaS/AI 相关的
    const KEEP = ['show hn','ask hn','saas','tool','startup','ai','launch','maker','revenue','mrr','indie','product','automation','api'];
    const results = [];

    // 并行抓前 60 条，然后过滤
    const batch = ids.slice(0, 60);
    const items = await Promise.all(
      batch.map(id =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
          .then(r => r.json()).catch(() => null)
      )
    );

    for (const item of items) {
      if (!item || item.type !== 'story' || !item.title || !item.url) continue;
      if ((item.score || 0) < 50) continue; // 至少 50 分才算优质
      const t = item.title.toLowerCase();
      if (!KEEP.some(k => t.includes(k))) continue;

      const title = fixTitle(item.title);
      const desc = item.text ? item.text.replace(/<[^>]+>/g,' ').slice(0,200) : '';
      const { score, reason } = scoreItem(title, desc);
      const { summary, opportunity } = generateInsight(title, desc);

      // HN 日期
      const dateKey = item.time
        ? new Date(item.time * 1000).toISOString().slice(0, 10)
        : today;

      results.push({
        id: `hn-${item.id}`,
        title, summary, opportunity, score, scoreReason: reason,
        url: item.url,
        source: 'hackernews', sourceLabel: 'Hacker News',
        hnScore: item.score,
        category: detectCategory(title + ' ' + desc),
        tags: ['HN精选'], fetchedAt: new Date().toISOString(), dateKey,
      });
    }
    console.log(`[HN] ${results.length} 条`);
    return results;
  } catch (e) { console.error('HN error:', e.message); return []; }
}

// ─── Main ──────────────────────────────────────────────────────────────────
(async () => {
  console.log('开始抓取:', new Date().toISOString());
  const [ph, tmrr, ih, hn] = await Promise.all([fetchProductHunt(), fetchTrustMRR(), fetchIndieHackers(), fetchHackerNews()]);
  const newItems = [...ph, ...tmrr, ...ih, ...hn];
  console.log(`新抓取: ${newItems.length} 条`);

  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (_) {}

  const existingIds = new Set(existing.map(i => i.id));
  const merged = [...newItems.filter(i => !existingIds.has(i.id)), ...existing].slice(0, 1000);
  fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2));
  console.log(`保存完成: 共 ${merged.length} 条`);
})();
