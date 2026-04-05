// V2EX 数据抓取模块（替代知乎 mock）
// V2EX 有公开 API，开发者社区，与"一人公司创业者"受众高度重合
// API 文档：https://www.v2ex.com/api

const V2EX_HOT     = 'https://www.v2ex.com/api/topics/hot.json';
const V2EX_STARTUP = 'https://www.v2ex.com/api/topics/show.json?node_name=startup';
const V2EX_CREATE  = 'https://www.v2ex.com/api/topics/show.json?node_name=create';

// 节点名 → 来源标签
const NODE_LABEL = {
  startup: 'V2EX 创业',
  create:  'V2EX 创意',
  share:   'V2EX 分享',
  programmer: 'V2EX 程序员',
};

// ─── 相关性筛选 ──────────────────────────────────────────────────────────────

const RELEVANT_KW = [
  '独立开发','副业','创业','一人','saas','工具','效率','自动化','插件','app','小程序',
  'ai','大模型','gpt','claude','gemini','api',
  '需求','痛点','赚钱','变现','收入','付费','订阅',
  '程序员','开发者','产品','运营','增长',
  '如何','怎么','有没有','推荐','求',
];
const IRRELEVANT_KW = [
  '游戏','电竞','明星','娱乐','电影','追剧','动漫','美食','旅行','健身',
  '政治','新闻','热点','八卦','相亲','感情',
];

function isRelevant(title, content) {
  const text = (title + ' ' + (content || '')).toLowerCase();
  if (IRRELEVANT_KW.some(k => text.includes(k))) return false;
  return RELEVANT_KW.some(k => text.includes(k));
}

// ─── 评分 ─────────────────────────────────────────────────────────────────

function scoreV2exItem(title, content, replies) {
  let score = 2;
  const text = (title + ' ' + (content || '')).toLowerCase();
  if (text.includes('独立开发') || text.includes('副业') || text.includes('变现') || text.includes('收入')) score += 1;
  if (text.includes('ai') || text.includes('大模型') || text.includes('saas') || text.includes('工具')) score += 1;
  if (text.includes('痛点') || text.includes('需求') || text.includes('如何') || text.includes('有没有')) score += 1;
  if ((replies || 0) > 30) score += 1;
  if (text.includes('创业') || text.includes('一人') || text.includes('付费')) score += 1;
  return Math.max(1, Math.min(5, score));
}

function detectV2exCategory(title, content, nodeName) {
  const text = (title + ' ' + (content || '')).toLowerCase();
  if (text.includes('ai') || text.includes('大模型') || text.includes('gpt')) return 'AI工具';
  if (text.includes('saas') || text.includes('软件') || text.includes('工具')) return 'SaaS工具';
  if (text.includes('独立开发') || text.includes('副业') || text.includes('变现')) return '创业者工具';
  if (text.includes('效率') || text.includes('自动化') || text.includes('工作流')) return '效率工具';
  if (text.includes('营销') || text.includes('获客') || text.includes('推广')) return '营销增长';
  if (text.includes('开发者') || text.includes('程序员') || text.includes('api')) return '开发者工具';
  if (nodeName === 'startup') return '创业者工具';
  if (nodeName === 'create') return '内容创作';
  return '数字工具';
}

// ─── 简单分析（只提取可靠字段，不生成模板深度分析）────────────────────────

function analyzeV2exItem(title, content) {
  const text = (title + ' ' + (content || '')).toLowerCase();

  // chinaFit 基于关键词判断
  let chinaFit = 'high'; // V2EX 本身就是中文社区，都是中国市场需求
  let chinaReason = '来自中文开发者社区的真实需求';
  let soloFit = 'maybe';
  let soloReason = '需结合具体方案评估技术复杂度';
  let problem = '';

  if (text.includes('ai') || text.includes('大模型')) {
    soloFit = 'yes';
    soloReason = '调用 API 即可，一人可快速构建垂直工具';
    chinaReason = '中文 AI 工具市场需求旺盛，海外产品水土不服';
  } else if (text.includes('独立开发') || text.includes('副业')) {
    soloFit = 'yes';
    soloReason = '服务开发者的工具，开发者自己用得上，PMF 验证快';
    chinaReason = '国内独立开发者社区成长，变现工具需求旺盛';
  } else if (text.includes('saas') || text.includes('工具')) {
    soloFit = 'maybe';
    soloReason = '垂直 SaaS 功能集中，MVP 可一人完成';
  }

  // 从标题提取问题（如果标题是疑问句）
  if (title.includes('如何') || title.includes('怎么') || title.includes('有没有')) {
    problem = title.replace(/[？?]$/, '').slice(0, 60);
  } else if (title.length > 10) {
    problem = title.slice(0, 60);
  }

  return { chinaFit, chinaReason, soloFit, soloReason, problem };
  // 注意：不生成 targetUsers/competitors/chinaGap/mvp/coldStart
  // 这些由 Qwen 深度分析填充，不由规则生成
}

// ─── 从 V2EX API 抓取 ────────────────────────────────────────────────────

async function fetchV2exTopics(url, label) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IdeaRadar/1.0)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('返回格式异常');
    console.log(`[V2EX] ${label} 获取 ${data.length} 条`);
    return data;
  } catch (e) {
    console.warn(`[V2EX] ${label} 失败: ${e.message}`);
    return [];
  }
}

// ─── 兜底 mock（仅在 API 完全失败时使用）────────────────────────────────────

const FALLBACK_TOPICS = [
  { id: 'f1', title: '独立开发 SaaS 如何找到第一个付费用户？', replies: 45, node: { name: 'startup' }, content: '独立开发 saas 工具，功能已经完成，怎么找到愿意付费的第一批用户' },
  { id: 'f2', title: '有没有好用的 AI 工具帮助整理会议记录？', replies: 32, node: { name: 'create' }, content: 'ai 大模型 会议记录整理 效率工具 自动化' },
  { id: 'f3', title: '做独立开发的你，副业月收入做到多少了？', replies: 89, node: { name: 'startup' }, content: '独立开发 副业 收入 变现 付费' },
  { id: 'f4', title: '一人做 SaaS：最难的是技术还是获客？', replies: 67, node: { name: 'startup' }, content: '一人公司 saas 创业 获客 运营' },
  { id: 'f5', title: 'AI 写的内容如何避免被检测？', replies: 41, node: { name: 'create' }, content: 'ai 内容创作 检测 工具 写作' },
];

// ─── 主函数 ───────────────────────────────────────────────────────────────

async function fetchZhihuData() {
  console.log('[V2EX] 开始抓取真实数据...');

  // 并行抓取热榜 + 创业节点 + 创意节点
  const [hot, startup, create] = await Promise.all([
    fetchV2exTopics(V2EX_HOT,     '热门话题'),
    fetchV2exTopics(V2EX_STARTUP, '创业节点'),
    fetchV2exTopics(V2EX_CREATE,  '创意节点'),
  ]);

  const rawItems = [...hot, ...startup, ...create];
  const useReal = rawItems.length > 0;
  const topics = useReal ? rawItems : FALLBACK_TOPICS;

  if (!useReal) console.warn('[V2EX] 所有 API 均失败，使用兜底数据');

  // 去重（按 id）
  const seen = new Set();
  const unique = [];
  for (const t of topics) {
    const key = String(t.id);
    if (!seen.has(key)) { seen.add(key); unique.push(t); }
  }

  // 筛选相关条目
  const relevant = unique.filter(t => isRelevant(t.title || '', t.content || ''));
  console.log(`[V2EX] 去重后 ${unique.length} 条，相关筛选 ${relevant.length} 条`);

  const today = new Date().toISOString().slice(0, 10);
  const results = [];

  for (const topic of relevant.slice(0, 20)) {
    const title = (topic.title || '').trim().slice(0, 100);
    if (!title) continue;

    const nodeName = topic.node?.name || '';
    const sourceLabel = NODE_LABEL[nodeName] || 'V2EX';
    const replies = topic.replies || 0;
    const content = (topic.content || '').slice(0, 200);
    const url = topic.url || `https://www.v2ex.com/t/${topic.id}`;

    const score = scoreV2exItem(title, content, replies);
    const analysis = analyzeV2exItem(title, content);
    const category = detectV2exCategory(title, content, nodeName);

    // 发布时间
    const created = topic.created ? new Date(topic.created * 1000) : new Date();
    const dateKey = created.toISOString().slice(0, 10);

    results.push({
      id: `v2ex-${topic.id}`,
      title,
      score,
      scoreReason: `${replies} 回复`,
      ...analysis,
      desc: content || `V2EX ${sourceLabel} 话题，${replies} 人参与`,
      url,
      source: 'zhihu',         // 保持 source='zhihu' 以复用中文标签页筛选
      sourceLabel,
      category,
      fetchedAt: new Date().toISOString(),
      dateKey,
      replyCount: replies,
    });
  }

  console.log(`[V2EX] 输出 ${results.length} 条`);
  return results;
}

module.exports = { fetchZhihuData };
