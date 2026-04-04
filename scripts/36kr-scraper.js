// 36氪数据抓取模块 — 真实 RSS + mock 降级
// 聚焦：创投热点 + 传统行业数字化痛点 + 国产替代方向

const RSS_URL = 'https://36kr.com/feed';
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
  // 格式: "2026-04-04 14:11:10  +0800" 或标准 RFC822
  const m = pubDate.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  try { return new Date(pubDate).toISOString().slice(0, 10); } catch (_) {}
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
// 保留与"传统行业痛点 / 创业机会"相关的文章，过滤游戏/娱乐/纯财报

const RELEVANT_KW = [
  '数字化','中小企业','传统行业','创业','独立开发','一人',
  'AI落地','大模型','工具','SaaS','saas','软件','自动化',
  '供应链','物流','仓储','餐饮','门店','零售','教育','医疗',
  '财税','HR','人力','私域','CRM','效率','管理系统',
  '国产替代','出海','副业','低代码','小程序','企业服务',
];

const IRRELEVANT_KW = [
  '游戏','电竞','明星','娱乐','体育','影视','综艺','电影',
  '天气','节假日','科幻','小说','漫画','博主',
];

function isRelevant(title, desc) {
  const text = title + ' ' + desc;
  if (IRRELEVANT_KW.some(k => text.includes(k))) return false;
  return RELEVANT_KW.some(k => text.includes(k));
}

// ─── 评分与分析 ───────────────────────────────────────────────────────────

function score36krItem(title, desc) {
  let score = 3;
  const text = (title + ' ' + desc).toLowerCase();
  if (text.includes('一人') || text.includes('独立开发') || text.includes('副业')) score += 1;
  if (text.includes('传统') || text.includes('数字化') || text.includes('信息化')) score += 1;
  if (text.includes('ai') || text.includes('人工智能') || text.includes('大模型')) score += 1;
  if (text.includes('中小') || text.includes('小微') || text.includes('个体')) score += 1;
  score = Math.max(1, Math.min(5, score));
  const reasons = ['AI工具', '数字化刚需', '中小企业市场', '一人可行', '创业机会'];
  const idx = Math.abs(title.charCodeAt(0) + title.length) % reasons.length;
  return { score, reason: reasons[idx] };
}

function analyze36krItem(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  let problem = '传统行业信息化程度低，人工成本高效率低';
  let chinaFit = 'high', chinaReason = '国内中小企业数字化需求旺盛';
  let soloFit = 'maybe', soloReason = '需结合具体产品复杂度评估';

  if (text.includes('ai') || text.includes('大模型')) {
    problem = '企业缺乏低成本落地 AI 的工具，海外产品合规风险大';
    chinaFit = 'high'; chinaReason = '政策支持国产 AI 替代，企业付费意愿强';
    soloFit = 'yes'; soloReason = '调用大模型 API 即可，前端工具技术门槛不高';
  } else if (text.includes('saas') || text.includes('工具') || text.includes('软件')) {
    problem = '中小企业依赖 Excel 和微信，缺乏适合国情的轻量 SaaS 工具';
    chinaFit = 'high'; chinaReason = '国内 SaaS 渗透率仅 7%，远低于美国 70%+';
    soloFit = 'yes'; soloReason = '垂直行业 SaaS 功能集中，一人可做到 MVP';
  } else if (text.includes('供应链') || text.includes('物流') || text.includes('仓')) {
    problem = '供应链环节纸质单据多，跨系统对账耗时，中小工厂数字化落后';
    chinaFit = 'high'; chinaReason = '中国有 600 万中小制造企业，供应链数字化率极低';
    soloFit = 'maybe'; soloReason = '需要对接工厂系统，集成复杂度高，但 MVP 可做单点';
  } else if (text.includes('餐饮') || text.includes('门店') || text.includes('零售')) {
    problem = '线下门店收银/管理系统老旧，缺乏数据化运营能力';
    chinaFit = 'high'; chinaReason = '中国有数千万家线下门店，数字化渗透率低';
    soloFit = 'yes'; soloReason = '微信小程序 + 云端，4 周可做出 MVP 验证';
  } else if (text.includes('教育') || text.includes('培训')) {
    problem = '传统教育机构排课/管理依赖 Excel 和纸质档案';
    chinaFit = 'high'; chinaReason = '教培市场大，转型需求强';
    soloFit = 'yes'; soloReason = '管理 SaaS 功能清晰，一人可开发垂直版本';
  } else if (text.includes('财税') || text.includes('会计') || text.includes('发票')) {
    problem = '中小企业财税合规靠人工，记账报税流程繁琐易出错';
    chinaFit = 'high'; chinaReason = '国内税务政策复杂，本土化工具需求强';
    soloFit = 'maybe'; soloReason = '需对接税务接口，技术门槛中等';
  }

  return {
    problem, chinaFit, chinaReason, soloFit, soloReason,
    targetUsers: '中小企业主、传统行业创业者、数字化转型负责人',
    competitors: '企业级 ERP（太重）；Excel+微信（效率低）；国内现有 SaaS 功能不够垂直',
    chinaGap: '国内中小企业数字化率不足 30%，本土化轻量工具严重缺位',
    mvp: '聚焦最高频 1 个场景，微信小程序 + 云端存储，4 周内上线验证',
    coldStart: '在行业协会/企业微信群冷启动，前 50 家免费换口碑和反馈',
  };
}

function detect36krCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('ai') || t.includes('大模型') || t.includes('智能')) return 'AI工具';
  if (t.includes('教育') || t.includes('培训') || t.includes('在线学')) return '教育学习';
  if (t.includes('医疗') || t.includes('健康') || t.includes('诊') || t.includes('药')) return '健康生活';
  if (t.includes('餐饮') || t.includes('食品') || t.includes('外卖')) return '本地服务';
  if (t.includes('零售') || t.includes('门店') || t.includes('商超')) return '电商工具';
  if (t.includes('供应链') || t.includes('物流') || t.includes('仓')) return '供应链';
  if (t.includes('财务') || t.includes('会计') || t.includes('税务') || t.includes('发票')) return '财务工具';
  if (t.includes('hr') || t.includes('人力') || t.includes('招聘') || t.includes('考勤')) return 'HR工具';
  if (t.includes('营销') || t.includes('私域') || t.includes('crm') || t.includes('获客')) return '营销增长';
  if (t.includes('创业') || t.includes('独立') || t.includes('一人')) return '创业者工具';
  return '数字工具';
}

// ─── mock 兜底数据 ────────────────────────────────────────────────────────

const MOCK_ARTICLES = [
  { title: '传统餐饮门店还在用手写记账，数字化收银只需一台平板', link: 'https://36kr.com/p/001', pubDate: '', desc: '餐饮门店数字化需求旺盛' },
  { title: '中小企业微信私域运营还靠手动群发？AI自动回复工具来了', link: 'https://36kr.com/p/002', pubDate: '', desc: '私域自动化工具' },
  { title: '独立开发者月入5万的秘密：只做一件事，做到极致', link: 'https://36kr.com/p/003', pubDate: '', desc: '独立开发者创业经验' },
  { title: '国内中小制造企业供应链管理还停留在Excel表格时代', link: 'https://36kr.com/p/004', pubDate: '', desc: '供应链数字化痛点' },
  { title: '传统建材行业报价还靠打电话？一人开发的SaaS工具解决了', link: 'https://36kr.com/p/005', pubDate: '', desc: '垂直行业SaaS机会' },
  { title: 'AI大模型落地中小企业：不是聊天机器人，而是自动化流程', link: 'https://36kr.com/p/006', pubDate: '', desc: 'AI工具企业落地' },
  { title: '个体工商户财税合规最怕什么？记账开票报税全流程痛点', link: 'https://36kr.com/p/007', pubDate: '', desc: '财税工具需求' },
  { title: '美发店还在用手写预约本？这个痛点孕育了一个百万用户产品', link: 'https://36kr.com/p/008', pubDate: '', desc: '本地服务数字化' },
  { title: '一人公司创业实录：用AI工具把运营成本压到极致', link: 'https://36kr.com/p/009', pubDate: '', desc: '一人公司创业' },
  { title: '国产替代浪潮下，企业协同办公工具赛道还有机会吗', link: 'https://36kr.com/p/010', pubDate: '', desc: '企业协同工具' },
  { title: '中小学外教机构课程管理混乱，排课排到头大', link: 'https://36kr.com/p/011', pubDate: '', desc: '教育机构管理工具' },
  { title: '人力资源外包公司的痛：员工档案管理全靠Excel堆', link: 'https://36kr.com/p/012', pubDate: '', desc: 'HR数字化工具' },
  { title: '三四线城市连锁门店管理难题：总部如何实时监控各门店数据', link: 'https://36kr.com/p/013', pubDate: '', desc: '连锁门店管理' },
  { title: '传统物流行业司机端APP体验差：路线规划全靠嘴问', link: 'https://36kr.com/p/014', pubDate: '', desc: '物流数字化' },
  { title: '社区团购平台衰退后，实体菜市场数字化迎来第二春', link: 'https://36kr.com/p/015', pubDate: '', desc: '生鲜零售数字化' },
];

// ─── 主函数 ───────────────────────────────────────────────────────────────

async function fetch36krData() {
  console.log('[36氪] 开始抓取真实 RSS 数据...');

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
    articles = filtered.length >= 5 ? filtered : parsed.slice(0, 20); // 若过滤后太少则放宽
    isReal = true;
    console.log(`[36氪] RSS 解析 ${parsed.length} 条，相关筛选 ${filtered.length} 条`);
  } catch (err) {
    console.warn(`[36氪] RSS 抓取失败 (${err.message})，使用 mock 数据降级`);
    articles = MOCK_ARTICLES;
  }

  const today = new Date().toISOString().slice(0, 10);
  const results = [];

  for (let i = 0; i < articles.length; i++) {
    const art = articles[i];
    const { score, reason } = score36krItem(art.title, art.desc);
    const analysis = analyze36krItem(art.title, art.desc);
    const category = detect36krCategory(art.title);
    const dateKey = parseDateKey(art.pubDate) || today;
    const idSuffix = isReal
      ? String(art.link).replace(/\D/g, '').slice(-8) || String(i).padStart(3, '0')
      : String(i + 1).padStart(3, '0');

    results.push({
      id: `36kr-${idSuffix}`,
      title: art.title.slice(0, 100),
      score, scoreReason: reason,
      ...analysis,
      desc: art.desc || `36氪报道，聚焦"${category}"方向的传统行业痛点`,
      url: art.link || `https://36kr.com`,
      source: '36kr',
      sourceLabel: isReal ? '36氪' : '36氪(样本)',
      category,
      fetchedAt: new Date().toISOString(),
      dateKey,
    });
  }

  console.log(`[36氪] 输出 ${results.length} 条 (${isReal ? '真实' : 'mock'})`);
  return results;
}

module.exports = { fetch36krData };
