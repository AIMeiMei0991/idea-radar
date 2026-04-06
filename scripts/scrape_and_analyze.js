/**
 * 创意雷达 v2 — 精准抓取痛点 + AI两段筛选 + 通义千问深度分析
 *
 * 数据来源（全部支持标题+正文+评论）：
 *   Reddit   — r/SomebodyMakeThis / r/needanapp / r/AppIdeas（专属需求版块）
 *   HackerNews — Ask HN 系列（工具需求型问题）
 *   V2EX     — qna / create / startup 节点（国内开发者痛点）
 *              V2EX 评论需要 PAT token，免费申请：v2ex.com/settings/tokens
 *              设置环境变量 V2EX_PAT=xxx 即可开启评论抓取
 *
 * 流程：
 *   1. 抓全文+评论（不截断）
 *   2. qwen-turbo 预筛：读完整内容判断是否真实需求（便宜10倍）
 *   3. qwen-plus 深分析：只处理通过预筛的高质量帖子
 *
 * node scripts/scrape_and_analyze.js
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const OpenAI = require('openai');

// ── 配置 ──────────────────────────────────────────────────────────────────────

const QWEN_KEY  = 'sk-ea127923cf19456fb783bc11421fd255';
const V2EX_PAT  = process.env.V2EX_PAT || '';          // 可选，开启V2EX评论
const DATE      = new Date().toISOString().slice(0, 10);
const CACHE_FILE = path.join(__dirname, `../public/data/qualified_${DATE}.json`);
const IDEAS_FILE = path.join(__dirname, '../public/data/ideas.json');

const qwen = new OpenAI({
  apiKey: QWEN_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

// ── HTTP ──────────────────────────────────────────────────────────────────────

function get(url, headers = {}) {
  return new Promise(resolve => {
    const opts = {
      headers: { 'User-Agent': 'Mozilla/5.0 IdeaRadar/2.0', ...headers },
    };
    const req = https.get(url, opts, res => {
      // 跟随重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, headers).then(resolve);
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Reddit ────────────────────────────────────────────────────────────────────
// 只抓专属需求版块，每条帖子拉完整正文+前5条热门评论

const REDDIT_SUBS = ['SomebodyMakeThis', 'needanapp', 'AppIdeas'];

async function fetchRedditSub(sub) {
  const list = await get(`https://www.reddit.com/r/${sub}/new.json?limit=50&sort=new`);
  if (!list?.data?.children?.length) return [];

  const posts = list.data.children.map(c => c.data).filter(p => p.score >= 3);
  const results = [];

  for (const post of posts.slice(0, 25)) {
    await sleep(500);
    // 拉完整帖子 + 评论（sort=top 让最有共鸣的评论靠前）
    const detail = await get(
      `https://www.reddit.com/r/${sub}/comments/${post.id}.json?sort=top&limit=10`
    );

    const body = post.selftext || '';
    const comments = detail?.[1]?.data?.children
      ?.filter(c => c.kind === 't1' && c.data?.body && c.data.body !== '[deleted]' && c.data.body !== '[removed]')
      ?.slice(0, 5)
      ?.map(c => c.data.body.slice(0, 400)) || [];

    // 过滤：正文或评论里要有实质内容
    if (body.length < 20 && comments.length === 0) continue;

    results.push({
      platform: 'Reddit',
      subreddit: sub,
      title: post.title,
      body,
      comments,
      score: post.score,
      numComments: post.num_comments || 0,
      url: `https://www.reddit.com${post.permalink}`,
    });
  }

  console.log(`  r/${sub}: ${results.length} 条（含评论）`);
  return results;
}

// ── HackerNews ────────────────────────────────────────────────────────────────
// 只抓 Ask HN，用 Algolia items API 拿完整正文+评论树

const HN_QUERIES = [
  'Ask HN: Is there a tool',
  'Ask HN: Why is there no',
  'Ask HN: I wish there was',
  'Ask HN: Anyone know of a',
  'Ask HN: Why hasn\'t anyone built',
];

async function fetchHN() {
  const seen = new Set();
  const results = [];

  for (const q of HN_QUERIES) {
    const data = await get(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=ask_hn&hitsPerPage=30`
    );
    if (!data?.hits) continue;

    for (const hit of data.hits) {
      if (seen.has(hit.objectID)) continue;
      seen.add(hit.objectID);
      if ((hit.points || 0) < 5) continue;

      await sleep(200);
      // Algolia items API 返回完整评论树
      const item = await get(`https://hn.algolia.com/api/v1/items/${hit.objectID}`);

      const body = (item?.text || hit.story_text || '').replace(/<[^>]*>/g, '').trim();
      // 拍平一级评论
      const comments = (item?.children || [])
        .filter(c => c.text && c.type === 'comment')
        .slice(0, 5)
        .map(c => c.text.replace(/<[^>]*>/g, '').slice(0, 400));

      results.push({
        platform: 'HackerNews',
        title: hit.title,
        body,
        comments,
        score: hit.points || 0,
        numComments: hit.num_comments || 0,
        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      });
    }
    await sleep(300);
  }

  console.log(`  HackerNews: ${results.length} 条（含评论）`);
  return results;
}

// ── V2EX ──────────────────────────────────────────────────────────────────────
// 国内开发者社区，覆盖技术/创业/产品痛点
// 无PAT：只能拿热帖（有标题+正文，无评论）
// 有PAT：可拿节点帖 + 评论，质量更高
// 申请PAT（免费）：https://www.v2ex.com/settings/tokens

const V2EX_NODES = ['qna', 'create', 'startup'];

async function fetchV2EX() {
  const results = [];

  if (V2EX_PAT) {
    // 有PAT：精准抓取指定节点+评论
    const authHeaders = { Authorization: `Bearer ${V2EX_PAT}` };

    for (const node of V2EX_NODES) {
      const data = await get(`https://www.v2ex.com/api/v2/nodes/${node}/topics?p=1`, authHeaders);
      const topics = data?.result || [];

      for (const topic of topics.slice(0, 15)) {
        if ((topic.replies || 0) < 2) continue;
        await sleep(400);

        const replyData = await get(
          `https://www.v2ex.com/api/v2/topics/${topic.id}/replies?p=1`,
          authHeaders
        );
        const comments = (replyData?.result || [])
          .slice(0, 5)
          .map(r => (r.content || '').slice(0, 400));

        results.push({
          platform: 'V2EX',
          node,
          title: topic.title,
          body: topic.content || '',
          comments,
          score: topic.replies || 0,
          numComments: topic.replies || 0,
          url: `https://www.v2ex.com/t/${topic.id}`,
        });
      }
      await sleep(600);
    }
  } else {
    // 无PAT：抓热帖，只有正文没有评论，AI预筛效果会弱一些
    const data = await get('https://www.v2ex.com/api/topics/hot.json');
    if (Array.isArray(data)) {
      for (const topic of data) {
        results.push({
          platform: 'V2EX',
          node: 'hot',
          title: topic.title,
          body: topic.content || '',
          comments: [],
          score: topic.replies || 0,
          numComments: topic.replies || 0,
          url: `https://www.v2ex.com/t/${topic.id}`,
        });
      }
    }
    if (!V2EX_PAT) {
      console.log('  V2EX: 未设置PAT，只抓热帖正文（无评论）');
      console.log('  → 申请PAT可大幅提升质量：v2ex.com/settings/tokens');
      console.log('  → 设置后：export V2EX_PAT=xxx && node scripts/scrape_and_analyze.js');
    }
  }

  console.log(`  V2EX: ${results.length} 条`);
  return results;
}

// ── AI 预筛（qwen-turbo，便宜快） ─────────────────────────────────────────────
// 读完整内容判断：这是不是一个真实的、具体的、还没被很好解决的需求？

async function preFilter(post) {
  const commentBlock = post.comments?.length
    ? `\n\n评论区（${post.comments.length}条，按热度排序）:\n${post.comments.map((c,i) => `[${i+1}] ${c}`).join('\n')}`
    : '';

  const prompt = `判断以下帖子是否包含一个真实的、具体的、未被很好解决的需求或痛点。

标题: ${post.title}
正文: ${(post.body || '').slice(0, 600)}${commentBlock}

判断标准：
- yes：作者描述了真实困境，说明了为什么现有工具不够用；或评论里多人表达同样的痛点
- no：只是泛泛的功能建议、已有成熟方案、纯讨论/闲聊、与商业机会无关

只回复 yes 或 no。`;

  try {
    const res = await qwen.chat.completions.create({
      model: 'qwen-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 5,
    });
    return res.choices[0].message.content.trim().toLowerCase().startsWith('yes');
  } catch {
    return false;
  }
}

// ── AI 深度分析（qwen-plus，基于完整内容） ────────────────────────────────────

async function analyzeWithQwen(post) {
  const commentBlock = post.comments?.length
    ? `\n\n评论区反馈（最能反映需求真实程度）:\n${post.comments.map((c,i) => `[${i+1}] ${c}`).join('\n')}`
    : '';

  const prompt = `你是"创意雷达"产品分析师。基于帖子的完整内容（标题+正文+评论）分析创业机会。
注意：分析必须忠于原文，不要编造或过度推断。

来源: ${post.platform}${post.subreddit ? ` r/${post.subreddit}` : ''}${post.node ? ` [${post.node}]` : ''}
热度: ${post.score} 赞 · ${post.numComments} 评论
标题: ${post.title}
正文: ${(post.body || '（无正文）').slice(0, 1200)}${commentBlock}

只返回 JSON，不要任何额外文字：

{
  "title": "用中文提炼创业机会标题（20字以内，具体有吸引力）",
  "score": 1到10的整数,
  "scoreReason": "一句话评分理由（结合评论共鸣程度）",
  "problem": "谁在痛？什么具体场景？为什么现有工具解决不了？（100字以内，基于原文，不编造）",
  "targetUsers": "目标用户画像（50字以内）",
  "competitors": "国内外现有竞品及核心不足（50字以内）",
  "soloFit": "yes或maybe或no",
  "soloReason": "一人能做吗？核心技术难点？MVP周期估算？（60字以内）",
  "chinaFit": "high或medium或low",
  "chinaReason": "中国市场需求规模与特点（50字以内）",
  "chinaGap": "国内市场空白点（50字以内）",
  "mvp": "最小可行产品：核心功能3条以内（60字以内）",
  "coldStart": "冷启动获取前100用户的具体方法（50字以内）",
  "category": "AI工具或效率工具或金融工具或教育或健康或本地服务或开发者工具或其他"
}`;

  try {
    const res = await qwen.chat.completions.create({
      model: 'qwen-plus',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
    });
    const content = res.choices[0].message.content;
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    console.error(`  ⚠️ 解析失败: ${e.message}`);
    return null;
  }
}

// ── 写入 ideas.json ───────────────────────────────────────────────────────────

function appendToIdeas(newItems) {
  let existing = [];
  if (fs.existsSync(IDEAS_FILE)) {
    existing = JSON.parse(fs.readFileSync(IDEAS_FILE, 'utf-8'));
  }
  const existingUrls = new Set(existing.map(i => i.url));
  const toAdd = newItems.filter(i => i.url && !existingUrls.has(i.url));
  fs.writeFileSync(IDEAS_FILE, JSON.stringify([...existing, ...toAdd], null, 2), 'utf-8');
  return toAdd.length;
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  // ── Step 1: 抓取 ──────────────────────────────────────
  let qualified;

  if (fs.existsSync(CACHE_FILE)) {
    console.log(`📂 加载缓存（已预筛）: ${CACHE_FILE}`);
    qualified = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    console.log(`   ${qualified.length} 条等待深度分析`);
  } else {
    console.log('🚀 开始抓取（标题+正文+评论）...');

    const [r1, r2, r3, hn, v2ex] = await Promise.all([
      fetchRedditSub('SomebodyMakeThis'),
      fetchRedditSub('needanapp'),
      fetchRedditSub('AppIdeas'),
      fetchHN(),
      fetchV2EX(),
    ]);
    const all = [...r1, ...r2, ...r3, ...hn, ...v2ex];
    console.log(`\n📦 共抓取 ${all.length} 条`);

    // 去掉已在数据库里的URL
    const existing = fs.existsSync(IDEAS_FILE)
      ? JSON.parse(fs.readFileSync(IDEAS_FILE, 'utf-8'))
      : [];
    const existingUrls = new Set(existing.map(i => i.url));
    const candidates = all.filter(p => p.url && !existingUrls.has(p.url));
    console.log(`🔍 去重后 ${candidates.length} 条新内容\n`);

    // ── Step 2: AI 预筛 ────────────────────────────────
    console.log('⚡ AI预筛中（qwen-turbo 读全文+评论）...');
    qualified = [];
    let passed = 0, failed = 0;

    for (const post of candidates) {
      const ok = await preFilter(post);
      if (ok) {
        process.stdout.write('✓');
        qualified.push(post);
        passed++;
      } else {
        process.stdout.write('✗');
        failed++;
      }
      await sleep(120);
    }
    console.log(`\n✅ 通过预筛: ${passed} 条  ❌ 过滤掉: ${failed} 条`);

    // 缓存预筛结果，避免重复花钱
    fs.writeFileSync(CACHE_FILE, JSON.stringify(qualified, null, 2), 'utf-8');
  }

  // ── Step 3: 深度分析 ──────────────────────────────────
  console.log(`\n🧠 深度分析 ${qualified.length} 条（qwen-plus 基于全文）...\n`);

  const analyzed = [];
  for (let i = 0; i < qualified.length; i++) {
    const post = qualified[i];
    const label = `[${i + 1}/${qualified.length}] [${post.platform}] ${post.title.slice(0, 50)}`;
    console.log(label);

    const result = await analyzeWithQwen(post);
    if (!result) { console.log('  ⬜ 跳过（解析失败）\n'); continue; }

    const sourceMap = { Reddit: 'reddit', HackerNews: 'hackernews', V2EX: 'v2ex' };
    analyzed.push({
      id: `${post.platform.toLowerCase()}-${post.url.split('/').pop() || Date.now()}-${i}`,
      ...result,
      desc: `来自 ${post.platform}，${post.score} 赞 · ${post.numComments} 评论`,
      url: post.url,
      source: sourceMap[post.platform] || post.platform.toLowerCase(),
      sourceLabel: post.platform,
      fetchedAt: new Date().toISOString(),
      dateKey: DATE,
      views: post.score,
    });
    console.log(`  ✅ ${result.title} [${result.score}分]\n`);
    await sleep(500);
  }

  const added = appendToIdeas(analyzed);
  console.log(`\n🎉 完成！新增 ${added} 条高质量痛点数据`);
  console.log(`📁 ${IDEAS_FILE}`);
}

main().catch(console.error);
