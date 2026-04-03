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

// ─── 分类检测 ──────────────────────────────────────────────────────────────
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

// ─── 评分 ──────────────────────────────────────────────────────────────────
const HIGH_KEYWORDS = ['ai','automation','saas','creator','marketing','analytics','video','schedule','content','agent','tool'];
const LOW_KEYWORDS  = ['game','dating','nft','crypto','gambling','blockchain'];
const CHINA_KEYWORDS = ['creator','video','content','social','marketing','ecommerce','schedule','seo','analytics','email'];

function scoreItem(title, desc, mrr, baseScore = 2) {
  const text = (title + ' ' + (desc || '')).toLowerCase();
  let score = baseScore;
  const reasons = [];
  if (mrr) { score += 2; reasons.push(`已验证收入 ${mrr}`); }
  if (HIGH_KEYWORDS.some(k => text.includes(k))) { score += 1; reasons.push('热门赛道'); }
  if (LOW_KEYWORDS.some(k => text.includes(k)))  { score -= 2; reasons.push('中国受限'); }
  if (CHINA_KEYWORDS.filter(k => text.includes(k)).length >= 2) { score += 1; reasons.push('适配中国市场'); }
  return { score: Math.max(1, Math.min(5, score)), reason: reasons.join(' · ') || '基础工具' };
}

// ─── 核心分析：金点子三维评估 ─────────────────────────────────────────────
// 返回 { problem, chinaFit, chinaReason, soloFit, soloReason }
function analyzeProduct(title, desc, mrr) {
  const text = (title + ' ' + (desc || '')).toLowerCase();

  // ── 1. 核心问题（这个产品解决了什么） ──────────────────────────────────
  let problem;
  if (text.includes('ai') && text.includes('video'))
    problem = '创作者批量生成视频，解决产量低的效率瓶颈';
  else if (text.includes('ai') && (text.includes('write') || text.includes('copy') || text.includes('content')))
    problem = '降低内容创作成本，一个人输出10人的产量';
  else if (text.includes('ai') && text.includes('seo'))
    problem = 'AI 生成 SEO 文章，解决内容获客成本高的问题';
  else if (text.includes('ai') && (text.includes('resume') || text.includes('job')))
    problem = 'AI 优化简历和求职材料，提升面试邀请率';
  else if (text.includes('ai') && text.includes('email'))
    problem = 'AI 起草个性化邮件，B2B 销售触达效率翻倍';
  else if (text.includes('ai') && text.includes('customer'))
    problem = 'AI 客服自动处理高频问题，降低人工成本';
  else if (text.includes('ai'))
    problem = 'AI 替代某类重复劳动，降低专业门槛和人力成本';
  else if (text.includes('schedule') || text.includes('social media'))
    problem = '多平台内容自动排期发布，运营人员从重复劳动解放';
  else if (text.includes('email') && text.includes('outreach'))
    problem = '冷邮件获客自动化，解决 B2B 销售触达效率低问题';
  else if (text.includes('email'))
    problem = '邮件营销精准触达，用自动化提升付费转化率';
  else if (text.includes('analytics') || text.includes('attribution'))
    problem = '广告数据归因透明化，让每一分投放花得值';
  else if (text.includes('invoice') || text.includes('accounting') || text.includes('finance'))
    problem = '自动化记账报税，中小企业/自由职业者省时 80%';
  else if (text.includes('agent') || text.includes('automation'))
    problem = 'AI Agent 接管重复工作流，释放人力做高价值事';
  else if (text.includes('design') || text.includes('template'))
    problem = '降低设计门槛，非设计师也能产出专业级图文';
  else if (text.includes('ecommerce') || text.includes('shopify') || text.includes('amazon'))
    problem = '跨境电商运营提效，降低选品和投流决策成本';
  else if (text.includes('creator') || text.includes('monetiz'))
    problem = '帮创作者建立独立变现渠道，摆脱平台高抽成';
  else if (text.includes('crm') || text.includes('customer'))
    problem = '客户线索统一管理，防止销售跟进遗漏丢单';
  else if (text.includes('health') || text.includes('sleep') || text.includes('wellness'))
    problem = '健康数据追踪 + AI 建议，改善日常生活质量';
  else if (text.includes('developer') || text.includes('api') || text.includes('devops'))
    problem = '开发工具提效，减少工程师重复搭建基础设施';
  else if (text.includes('hire') || text.includes('recruit'))
    problem = '招聘流程自动化，减少 HR 在筛简历上的时间';
  else if (mrr)
    problem = '已有用户愿意付费的 SaaS 产品，具体方向见原链接';
  else
    problem = '垂直领域效率工具，有明确用户群的付费需求';

  // ── 2. 中国市场可复制性 ──────────────────────────────────────────────────
  const HIGH_CHINA = ['video','creator','content','social','marketing','ecommerce',
                      'schedule','seo','design','analytics','template','email','crm','短视频'];
  const LOW_CHINA  = ['crypto','nft','blockchain','gambling','dating','compliance',
                      'gdpr','hipaa','medicare','insurance','gun','weapon'];

  let chinaFit, chinaReason;
  if (LOW_CHINA.some(k => text.includes(k))) {
    chinaFit = 'low';
    chinaReason = '涉及受限领域，直接复制风险高';
  } else if (HIGH_CHINA.filter(k => text.includes(k)).length >= 2) {
    chinaFit = 'high';
    chinaReason = '国内同类需求旺盛，工具信息差大';
  } else if (HIGH_CHINA.some(k => text.includes(k))) {
    chinaFit = 'high';
    chinaReason = '对应国内真实需求，有本土化空间';
  } else if (text.includes('ai') || text.includes('saas')) {
    chinaFit = 'mid';
    chinaReason = 'AI/SaaS 赛道在国内有增量，需本土化';
  } else if (text.includes('developer') || text.includes('api') || text.includes('enterprise')) {
    chinaFit = 'mid';
    chinaReason = 'B2D/企业服务，付费意愿需单独验证';
  } else {
    chinaFit = 'mid';
    chinaReason = '通用工具，需评估国内实际市场规模';
  }

  // ── 3. 一人公司可行性 ────────────────────────────────────────────────────
  const SOLO_YES  = ['tool','widget','chrome','plugin','extension','api','webhook',
                     'notification','alert','tracker','monitor','generator','converter',
                     'calculator','summarizer','transcriber','scheduler','scraper'];
  const SOLO_HARD = ['marketplace','social network','community platform','hiring platform',
                     'freelance marketplace','two-sided','peer-to-peer','p2p network'];

  let soloFit, soloReason;
  if (SOLO_HARD.some(k => text.includes(k))) {
    soloFit = 'hard';
    soloReason = '双边/社区产品，冷启动需要团队资源';
  } else if (SOLO_YES.some(k => text.includes(k))) {
    soloFit = 'yes';
    soloReason = '工具型产品，技术+运营一人可驱动';
  } else if (text.includes('saas') || text.includes('automation') || text.includes('ai')) {
    soloFit = 'yes';
    soloReason = 'SaaS/AI 工具，无代码或小成本可验证';
  } else if (text.includes('content') || text.includes('newsletter') || text.includes('education')) {
    soloFit = 'yes';
    soloReason = '内容型业务，个人品牌驱动，一人起步';
  } else {
    soloFit = 'maybe';
    soloReason = '需结合具体功能范围评估开发量';
  }

  return { problem, chinaFit, chinaReason, soloFit, soloReason };
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
      const analysis = analyzeProduct(title, desc, null);

      results.push({
        id: `ph-${Buffer.from(url).toString('base64').slice(0,16)}`,
        title: fixTitle(title), score, scoreReason: reason,
        ...analysis,
        url, source: 'producthunt', sourceLabel: 'Product Hunt',
        category: detectCategory(title + ' ' + desc),
        fetchedAt: new Date().toISOString(), dateKey,
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
      // TMRR 基础分 3：上面的都是有真实收入的产品
      const { score, reason } = scoreItem(title, '', mrr, 3);
      const analysis = analyzeProduct(title, mrr ? `verified mrr ${mrr}` : '', mrr);

      results.push({
        id: `tmrr-${Buffer.from(p).toString('base64').slice(0,16)}`,
        title, score, scoreReason: reason,
        ...analysis,
        url: `https://trustmrr.com${p}`,
        source: 'trustmrr', sourceLabel: 'TrustMRR',
        mrr, category: detectCategory(title),
        fetchedAt: new Date().toISOString(), dateKey: today,
      });
    }
    console.log(`[TMRR] ${results.length} 条`);
    return results.slice(0, 25);
  } catch (e) { console.error('TMRR error:', e.message); return []; }
}

// ─── Reddit (r/SaaS + r/startups + r/entrepreneur) ────────────────────────
async function fetchReddit() {
  const SUBS = ['SaaS', 'startups', 'entrepreneur'];
  const KEEP = ['saas','tool','ai','launch','revenue','mrr','startup','product','automation',
                'api','indie','maker','software','app','platform','build','ship','idea'];
  const results = [];
  const seen = new Set();

  for (const sub of SUBS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/top.json?t=day&limit=25`, {
        headers: { 'User-Agent': 'IdeaRadar/1.0 (personal aggregator)' }
      });
      if (!res.ok) continue;
      const json = await res.json();
      const posts = json?.data?.children || [];

      for (const { data: post } of posts) {
        if (!post.title || !post.url) continue;
        if ((post.score || 0) < 20) continue;
        if (seen.has(post.id)) continue;
        seen.add(post.id);

        const t = post.title.toLowerCase();
        if (!KEEP.some(k => t.includes(k))) continue;

        const title = fixTitle(post.title.trim());
        const desc = post.selftext ? post.selftext.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
        const redditBase = post.score >= 200 ? 3 : 2;
        const { score, reason } = scoreItem(title, desc, null, redditBase);
        const analysis = analyzeProduct(title, desc, null);
        const dateKey = post.created_utc
          ? new Date(post.created_utc * 1000).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        const url = post.is_self
          ? `https://www.reddit.com${post.permalink}`
          : (post.url.startsWith('http') ? post.url : `https://www.reddit.com${post.permalink}`);

        results.push({
          id: `reddit-${post.id}`,
          title, score, scoreReason: reason,
          ...analysis,
          url, source: 'reddit', sourceLabel: `r/${sub}`,
          redditScore: post.score,
          category: detectCategory(title + ' ' + desc),
          fetchedAt: new Date().toISOString(), dateKey,
        });
      }
    } catch (e) { console.error(`Reddit r/${sub} error:`, e.message); }
  }
  console.log(`[Reddit] ${results.length} 条`);
  return results.slice(0, 30);
}

// ─── Hacker News ─────────────────────────────────────────────────────────
async function fetchHackerNews() {
  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!res.ok) return [];
    const ids = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    const KEEP = ['show hn','ask hn','saas','tool','startup','ai','launch','maker',
                  'revenue','mrr','indie','product','automation','api'];
    const results = [];

    const items = await Promise.all(
      ids.slice(0, 60).map(id =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
          .then(r => r.json()).catch(() => null)
      )
    );

    for (const item of items) {
      if (!item || item.type !== 'story' || !item.title || !item.url) continue;
      if ((item.score || 0) < 50) continue;
      const t = item.title.toLowerCase();
      if (!KEEP.some(k => t.includes(k))) continue;

      const title = fixTitle(item.title);
      const desc = item.text ? item.text.replace(/<[^>]+>/g,' ').slice(0,200) : '';
      const { score, reason } = scoreItem(title, desc);
      const analysis = analyzeProduct(title, desc, null);
      const dateKey = item.time
        ? new Date(item.time * 1000).toISOString().slice(0, 10) : today;

      results.push({
        id: `hn-${item.id}`,
        title, score, scoreReason: reason,
        ...analysis,
        url: item.url, source: 'hackernews', sourceLabel: 'Hacker News',
        hnScore: item.score,
        category: detectCategory(title + ' ' + desc),
        fetchedAt: new Date().toISOString(), dateKey,
      });
    }
    console.log(`[HN] ${results.length} 条`);
    return results;
  } catch (e) { console.error('HN error:', e.message); return []; }
}

// ─── Main ──────────────────────────────────────────────────────────────────
(async () => {
  console.log('开始抓取:', new Date().toISOString());
  const [ph, tmrr, reddit, hn] = await Promise.all([
    fetchProductHunt(), fetchTrustMRR(), fetchReddit(), fetchHackerNews()
  ]);
  const newItems = [...ph, ...tmrr, ...reddit, ...hn];
  console.log(`新抓取: ${newItems.length} 条`);

  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (_) {}

  const newIds = new Set(newItems.map(i => i.id));
  const merged = [...newItems, ...existing.filter(i => !newIds.has(i.id))].slice(0, 1000);
  fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2));
  console.log(`保存完成: 共 ${merged.length} 条`);
})();
