// 少数派数据抓取模块 — 真实 RSS + mock 降级
// 聚焦：效率工具、独立开发、生产力应用、独立创作者痛点
// 受众与"一人公司创业者"高度重合

const RSS_URL = 'https://sspai.com/feed';
const FETCH_TIMEOUT = 10000;

// ─── RSS 解析工具 ─────────────────────────────────────────────────────────

function extractCDATA(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`));
  return m ? m[1].trim() : null;
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
  return m ? m[1].trim() : null;
}

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ').trim();
}

function parseDateKey(pubDate) {
  if (!pubDate) return new Date().toISOString().slice(0, 10);
  const m = pubDate.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  try {
    // RFC 822: "Sat, 04 Apr 2026 17:11:10 +0800"
    return new Date(pubDate).toISOString().slice(0, 10);
  } catch (_) {}
  return new Date().toISOString().slice(0, 10);
}

function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title   = extractCDATA(block, 'title')       || extractTag(block, 'title')   || '';
    const link    = extractCDATA(block, 'link')        || extractTag(block, 'link')    || '';
    const pubDate = extractTag(block, 'pubDate')       || '';
    const rawDesc = extractCDATA(block, 'description') || '';
    const desc    = stripHtml(rawDesc).slice(0, 250);
    if (title) items.push({ title, link, pubDate, desc });
  }
  return items;
}

// ─── 相关性筛选 ───────────────────────────────────────────────────────────
// 少数派内容多样，保留与工具/效率/独立开发相关的文章

const RELEVANT_KW = [
  // 工具/效率
  '效率','工具','app','应用','软件','工作流','生产力','自动化','插件','扩展',
  // 创业/独立开发
  '独立开发','创业','副业','一人','开发者','程序员','产品经理','saas','小程序',
  // AI
  'ai','大模型','gpt','claude','gemini','提示词','prompt','llm',
  // 知识/写作
  '笔记','写作','知识管理','信息管理','收集','整理','卡片','双链','obsidian','notion',
  // 财务/时间
  '财务','记账','时间管理','任务管理','项目管理','日历','提醒',
  // 平台
  'macos','ios','iphone','mac','快捷指令','shortcuts','飞书','notion','slack',
  // 设计
  '设计','ui','ux','原型','figma',
  // 变现
  '赚钱','收入','变现','付费','订阅','定价','商业',
  // sspai 常见高频词（仅工具/开发/AI相关上下文）
  '工作','流程','搭建','部署','搭配','组合','定制','迁移',
];

const IRRELEVANT_KW = [
  '手机评测','相机评测','相机推荐','镜头评测','耳机测评','耳机推荐',
  '显示器评测','键盘开箱','鼠标开箱','数码开箱','摄影技巧','摄影后期',
  '游戏','电竞','明星','娱乐','电影','追剧','动漫',
  '美食','旅行游记','节日','健身','运动装备',
];

function isRelevant(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  if (IRRELEVANT_KW.some(k => text.includes(k.toLowerCase()))) return false;
  return RELEVANT_KW.some(k => text.includes(k));
}

// ─── 评分 ─────────────────────────────────────────────────────────────────

function scoreSspaiItem(title, desc) {
  let score = 3;
  const text = (title + ' ' + desc).toLowerCase();
  if (text.includes('独立开发') || text.includes('副业') || text.includes('赚钱') || text.includes('变现')) score += 1;
  if (text.includes('效率') || text.includes('自动化') || text.includes('工作流')) score += 1;
  if (text.includes('ai') || text.includes('大模型') || text.includes('gpt')) score += 1;
  if (text.includes('一人') || text.includes('创业') || text.includes('付费')) score += 1;
  score = Math.max(1, Math.min(5, score));
  const reasons = ['效率工具', '独立开发', 'AI应用', '生产力', '工作流优化'];
  const idx = Math.abs(title.charCodeAt(0) + title.length) % reasons.length;
  return { score, reason: reasons[idx] };
}

// ─── 分析 ─────────────────────────────────────────────────────────────────

function analyzeSspaiItem(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();

  let problem = '知识工作者缺乏高效的工具组合，重复劳动多';
  let chinaFit = 'high', chinaReason = '国内效率工具市场快速增长，用户付费意愿提升';
  let soloFit = 'yes', soloReason = '效率工具功能边界清晰，一人可做到 MVP';

  if (text.includes('ai') || text.includes('大模型') || text.includes('gpt')) {
    problem = '普通用户难以高效使用 AI，缺乏贴合中国场景的 AI 工作流工具';
    chinaFit = 'high'; chinaReason = '中文 AI 工具需求旺盛，本土场景海外工具不适配';
    soloFit = 'yes'; soloReason = '调用 API + 前端，一人可快速构建垂直 AI 工具';
  } else if (text.includes('笔记') || text.includes('知识') || text.includes('信息')) {
    problem = '知识工作者在多个笔记/信息工具间切换，碎片化严重难以沉淀';
    chinaFit = 'high'; chinaReason = '国内用户对本土化笔记工具需求强，数据安全要求高';
    soloFit = 'yes'; soloReason = '笔记工具技术门槛不高，差异化在产品设计';
  } else if (text.includes('自动化') || text.includes('工作流') || text.includes('快捷')) {
    problem = '重复性工作占用大量时间，但设置自动化的门槛对普通用户太高';
    chinaFit = 'high'; chinaReason = '国内缺乏类似 Zapier 的本土无代码自动化平台';
    soloFit = 'yes'; soloReason = '无代码工具一人可做，差异化在中国平台集成（微信/钉钉/飞书）';
  } else if (text.includes('财务') || text.includes('记账') || text.includes('理财')) {
    problem = '个人/自由职业者财务管理混乱，缺乏适合中国国情的轻量记账工具';
    chinaFit = 'high'; chinaReason = '国内个人记账需求大，现有工具广告多体验差';
    soloFit = 'yes'; soloReason = '轻量记账工具一人可做，微信小程序即可验证';
  } else if (text.includes('独立开发') || text.includes('副业') || text.includes('变现')) {
    problem = '独立开发者缺乏变现工具和获客渠道，无法从技术能力转化为收入';
    chinaFit = 'high'; chinaReason = '国内独立开发者社区成长，对变现工具和方法论需求旺盛';
    soloFit = 'yes'; soloReason = '服务开发者的工具本身就是开发者在用，PMF 验证快';
  }

  return {
    problem, chinaFit, chinaReason, soloFit, soloReason,
    targetUsers: '效率爱好者、独立开发者、知识工作者、自由职业者',
    competitors: '海外效率工具（Notion/Obsidian）本土化不足；国内竞品广告重体验差',
    chinaGap: '贴合中国用户习惯（微信生态、国内 AI 模型）的效率工具严重缺位',
    mvp: '单一场景工具，4 周内上线 App 或小程序，付费用户达 50 即验证可行',
    coldStart: '发布在少数派/即刻/独立开发者社群，前 100 用户靠口碑传播',
  };
}

function detectSspaiCategory(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  if (text.includes('ai') || text.includes('大模型') || text.includes('gpt')) return 'AI工具';
  if (text.includes('笔记') || text.includes('知识') || text.includes('卡片')) return '知识管理';
  if (text.includes('自动化') || text.includes('工作流') || text.includes('快捷')) return '效率工具';
  if (text.includes('财务') || text.includes('记账') || text.includes('理财')) return '财务工具';
  if (text.includes('独立开发') || text.includes('副业') || text.includes('变现')) return '创业者工具';
  if (text.includes('设计') || text.includes('ui') || text.includes('原型')) return '设计工具';
  if (text.includes('macos') || text.includes('ios') || text.includes('iphone')) return '效率工具';
  return '效率工具';
}

// ─── mock 兜底数据 ────────────────────────────────────────────────────────

const MOCK_ARTICLES = [
  { title: '用 AI 工具把我的工作流提升了 10 倍效率，这是我的实践', link: 'https://sspai.com/post/001', pubDate: '', desc: 'AI工作流效率实践' },
  { title: '独立开发者一年收入 20 万：只靠一个解决痛点的小工具', link: 'https://sspai.com/post/002', pubDate: '', desc: '独立开发者变现案例' },
  { title: '我用这个方法管理碎片信息，终于解决了知识过载问题', link: 'https://sspai.com/post/003', pubDate: '', desc: '知识管理痛点解决' },
  { title: '自由职业者的记账困境：有哪些真正好用的国产记账工具？', link: 'https://sspai.com/post/004', pubDate: '', desc: '记账工具需求' },
  { title: '少数派编辑部的工具箱：2026 年我们最依赖的效率 App', link: 'https://sspai.com/post/005', pubDate: '', desc: '效率工具推荐' },
  { title: '做副业被这些重复工作拖垮了？试试这几个自动化方案', link: 'https://sspai.com/post/006', pubDate: '', desc: '副业自动化工具' },
  { title: '国产 AI 写作工具横评：谁最适合中文场景？', link: 'https://sspai.com/post/007', pubDate: '', desc: 'AI写作工具对比' },
  { title: '个人知识库从零搭建：工具选择与工作流设计完全指南', link: 'https://sspai.com/post/008', pubDate: '', desc: '知识库搭建指南' },
  { title: '微信生态里做独立产品：小程序变现实战经验', link: 'https://sspai.com/post/009', pubDate: '', desc: '小程序独立开发' },
  { title: '用 Claude/GPT 搭建私人自动化助手，解放重复工作', link: 'https://sspai.com/post/010', pubDate: '', desc: 'AI自动化工作流' },
];

// ─── 主函数 ───────────────────────────────────────────────────────────────

async function fetchSspaiData() {
  console.log('[少数派] 开始抓取真实 RSS 数据...');

  let articles = [];
  let isReal = false;

  try {
    const res = await fetch(RSS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const parsed = parseRSSItems(xml);
    const filtered = parsed.filter(a => isRelevant(a.title, a.desc));
    articles = filtered.length >= 3 ? filtered : parsed.slice(0, 15);
    isReal = true;
    console.log(`[少数派] RSS 解析 ${parsed.length} 条，相关筛选 ${filtered.length} 条`);
  } catch (err) {
    console.warn(`[少数派] RSS 抓取失败 (${err.message})，使用 mock 数据降级`);
    articles = MOCK_ARTICLES;
  }

  const today = new Date().toISOString().slice(0, 10);
  const results = [];

  for (let i = 0; i < articles.length; i++) {
    const art = articles[i];
    const { score, reason } = scoreSspaiItem(art.title, art.desc);
    const analysis = analyzeSspaiItem(art.title, art.desc);
    const category = detectSspaiCategory(art.title, art.desc);
    const dateKey = parseDateKey(art.pubDate) || today;
    const idSuffix = isReal
      ? String(art.link).replace(/\D/g, '').slice(-8) || String(i).padStart(3, '0')
      : String(i + 1).padStart(3, '0');

    results.push({
      id: `sspai-${idSuffix}`,
      title: art.title.slice(0, 100),
      score, scoreReason: reason,
      ...analysis,
      desc: art.desc || `少数派文章，聚焦"${category}"方向的效率工具与创业实践`,
      url: art.link || 'https://sspai.com',
      source: 'sspai',
      sourceLabel: isReal ? '少数派' : '少数派(样本)',
      category,
      fetchedAt: new Date().toISOString(),
      dateKey,
    });
  }

  console.log(`[少数派] 输出 ${results.length} 条 (${isReal ? '真实' : 'mock'})`);
  return results;
}

module.exports = { fetchSspaiData };
