/**
 * 创意雷达 — 自动抓取脚本（GitHub Actions 每天 08:00 CST 运行）
 *
 * 来源：
 *   Reddit   — r/SomebodyMakeThis / r/needanapp / r/AppIdeas（需求垂类版块）
 *   HackerNews — Ask HN 工具需求型问题
 *   V2EX     — qna / create / startup 节点（国内开发者痛点）
 *   ProductHunt — RSS，过滤高赞产品
 *   36氪      — RSS，过滤传统行业数字化内容
 *   少数派    — RSS，过滤效率/独立开发内容
 *
 * 流程：
 *   抓取 → qwen-turbo 预筛 → qwen-plus 深分析 → 质量过滤 → 写入 ideas.json
 *
 * 用法：
 *   node scripts/auto-scrape.js
 *   QWEN_API_KEY=xxx node scripts/auto-scrape.js
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const { preFilter, analyzeWithQwen, sleep } = require('./lib/ai-analyze');
const { appendToIdeas, IDEAS_FILE }         = require('./lib/write-ideas');

const V2EX_PAT = process.env.V2EX_PAT || '';
const DATE     = new Date().toISOString().slice(0, 10);
const CACHE    = path.join(__dirname, `../public/data/qualified_${DATE}.json`);

// ── HTTP ──────────────────────────────────────────────────────────────────────

function get(url, headers = {}) {
  return new Promise(resolve => {
    const opts = { headers: { 'User-Agent': 'Mozilla/5.0 IdeaRadar/3.0', ...headers } };
    const req = https.get(url, opts, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, headers).then(resolve);
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

// ── Reddit ────────────────────────────────────────────────────────────────────

const REDDIT_SUBS = ['SomebodyMakeThis', 'needanapp', 'AppIdeas'];

async function fetchRedditSub(sub) {
  const list = await get(`https://www.reddit.com/r/${sub}/new.json?limit=50&sort=new`);
  if (!list?.data?.children?.length) return [];

  const posts = list.data.children.map(c => c.data).filter(p => p.score >= 3);
  const results = [];

  for (const post of posts.slice(0, 25)) {
    await sleep(500);
    const detail = await get(
      `https://www.reddit.com/r/${sub}/comments/${post.id}.json?sort=top&limit=10`
    );
    const body = post.selftext || '';
    const comments = detail?.[1]?.data?.children
      ?.filter(c => c.kind === 't1' && c.data?.body && !['[deleted]', '[removed]'].includes(c.data.body))
      ?.slice(0, 5)
      ?.map(c => c.data.body.slice(0, 400)) || [];

    if (body.length < 20 && comments.length === 0) continue;

    results.push({
      platform: 'Reddit', subreddit: sub,
      title: post.title, body, comments,
      score: post.score, numComments: post.num_comments || 0,
      url: `https://www.reddit.com${post.permalink}`,
    });
  }
  console.log(`  r/${sub}: ${results.length} 条`);
  return results;
}

// ── HackerNews ────────────────────────────────────────────────────────────────

const HN_QUERIES = [
  'Ask HN: Is there a tool',
  'Ask HN: Why is there no',
  'Ask HN: I wish there was',
  "Ask HN: Why hasn't anyone built",
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
      const item = await get(`https://hn.algolia.com/api/v1/items/${hit.objectID}`);
      const body = (item?.text || hit.story_text || '').replace(/<[^>]*>/g, '').trim();
      const comments = (item?.children || [])
        .filter(c => c.text && c.type === 'comment')
        .slice(0, 5)
        .map(c => c.text.replace(/<[^>]*>/g, '').slice(0, 400));

      results.push({
        platform: 'HackerNews',
        title: hit.title, body, comments,
        score: hit.points || 0, numComments: hit.num_comments || 0,
        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      });
    }
    await sleep(300);
  }
  console.log(`  HackerNews: ${results.length} 条`);
  return results;
}

// ── V2EX ──────────────────────────────────────────────────────────────────────

const V2EX_NODES = ['qna', 'create', 'startup'];

async function fetchV2EX() {
  const results = [];

  if (V2EX_PAT) {
    const auth = { Authorization: `Bearer ${V2EX_PAT}` };
    for (const node of V2EX_NODES) {
      const data = await get(`https://www.v2ex.com/api/v2/nodes/${node}/topics?p=1`, auth);
      for (const t of (data?.result || []).slice(0, 15)) {
        if ((t.replies || 0) < 2) continue;
        await sleep(400);
        const replyData = await get(`https://www.v2ex.com/api/v2/topics/${t.id}/replies?p=1`, auth);
        const comments = (replyData?.result || []).slice(0, 5).map(r => (r.content || '').slice(0, 400));
        results.push({
          platform: 'V2EX', node,
          title: t.title, body: t.content || '', comments,
          score: t.replies || 0, numComments: t.replies || 0,
          url: `https://www.v2ex.com/t/${t.id}`,
        });
      }
      await sleep(600);
    }
  } else {
    const data = await get('https://www.v2ex.com/api/topics/hot.json');
    if (Array.isArray(data)) {
      for (const t of data) {
        results.push({
          platform: 'V2EX', node: 'hot',
          title: t.title, body: t.content || '', comments: [],
          score: t.replies || 0, numComments: t.replies || 0,
          url: `https://www.v2ex.com/t/${t.id}`,
        });
      }
    }
    console.log('  V2EX: 未设置PAT，只抓热帖（无评论）—— export V2EX_PAT=xxx 可开启节点模式');
  }

  console.log(`  V2EX: ${results.length} 条`);
  return results;
}

// ── RSS 工具函数 ──────────────────────────────────────────────────────────────

function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ').trim();
}

function extractXml(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? (m[1] || m[2] || '').trim() : '';
}

// ── Product Hunt RSS（Atom 格式）────────────────────────────────────────────

const PH_RSS = 'https://www.producthunt.com/feed';

// 过滤掉 PH 上游戏/硬件等与 SaaS 无关的类别
const PH_IRRELEVANT = ['game', 'games', 'gaming', 'hardware', 'phone case'];

async function fetchProductHunt() {
  const xml = await get(PH_RSS);
  if (typeof xml !== 'string') return [];

  const entries = xml.split('<entry>').slice(1);
  const results = [];

  for (const entry of entries.slice(0, 30)) {
    const title = (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').trim();
    const url   = entry.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/)?.[1]?.trim() || '';
    if (!title || !url) continue;
    if (PH_IRRELEVANT.some(k => title.toLowerCase().includes(k))) continue;

    const rawDesc = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] || '';
    const body = stripHtml(rawDesc.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')).slice(0, 400);

    results.push({
      platform: 'ProductHunt',
      title, body, comments: [],
      score: 0, numComments: 0, url,
    });
  }
  console.log(`  Product Hunt: ${results.length} 条`);
  return results;
}

// ── 36氪 RSS ──────────────────────────────────────────────────────────────────

const KRSS = 'https://36kr.com/feed';

const KR_RELEVANT  = ['数字化','中小企业','传统行业','创业','独立开发','AI落地','大模型','工具','SaaS','自动化','供应链','物流','餐饮','门店','零售','教育','医疗','财税','HR','私域','CRM','效率','国产替代','副业','低代码','企业服务'];
const KR_IRRELEVANT = ['游戏','电竞','明星','娱乐','体育','影视','综艺','电影','天气'];

async function fetch36kr() {
  const xml = await get(KRSS);
  if (typeof xml !== 'string') return [];

  const results = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = stripHtml(extractXml(block, 'title'));
    const link  = extractXml(block, 'link') || (block.match(/<link>([^<]+)<\/link>/)?.[1] || '');
    const body  = stripHtml(extractXml(block, 'description')).slice(0, 400);
    if (!title || !link) continue;
    const text = title + ' ' + body;
    if (KR_IRRELEVANT.some(k => text.includes(k))) continue;
    if (!KR_RELEVANT.some(k => text.includes(k))) continue;

    results.push({
      platform: '36氪',
      title, body, comments: [],
      score: 0, numComments: 0, url: link,
    });
  }
  console.log(`  36氪: ${results.length} 条（已过滤不相关）`);
  return results;
}

// ── 少数派 RSS ────────────────────────────────────────────────────────────────

const SSPAI_RSS = 'https://sspai.com/feed';

const SSPAI_RELEVANT  = ['效率','工具','app','应用','工作流','生产力','自动化','插件','独立开发','副业','AI','一人','创作者','快捷指令','Shortcut','脚本','Python','独立','创业'];
const SSPAI_IRRELEVANT = ['游戏','二次元','影视','动漫','美食','旅行','穿搭','数码评测','开箱'];

async function fetchSspai() {
  const xml = await get(SSPAI_RSS);
  if (typeof xml !== 'string') return [];

  const results = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = stripHtml(extractXml(block, 'title'));
    const link  = extractXml(block, 'link') || (block.match(/<link>([^<]+)<\/link>/)?.[1] || '');
    const body  = stripHtml(extractXml(block, 'description')).slice(0, 400);
    if (!title || !link) continue;
    const text = title + ' ' + body;
    if (SSPAI_IRRELEVANT.some(k => text.includes(k))) continue;
    if (!SSPAI_RELEVANT.some(k => text.includes(k))) continue;

    results.push({
      platform: '少数派',
      title, body, comments: [],
      score: 0, numComments: 0, url: link,
    });
  }
  console.log(`  少数派: ${results.length} 条（已过滤不相关）`);
  return results;
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  let qualified;

  // ── Step 1：抓取（或加载缓存）──────────────────────────────────────────────
  if (fs.existsSync(CACHE)) {
    console.log(`📂 加载缓存: ${CACHE}`);
    qualified = JSON.parse(fs.readFileSync(CACHE, 'utf-8'));
    console.log(`   ${qualified.length} 条等待深度分析`);
  } else {
    console.log('🚀 开始抓取...');
    const [r1, r2, r3, hn, v2ex, ph, kr, sp] = await Promise.all([
      fetchRedditSub('SomebodyMakeThis'),
      fetchRedditSub('needanapp'),
      fetchRedditSub('AppIdeas'),
      fetchHN(),
      fetchV2EX(),
      fetchProductHunt(),
      fetch36kr(),
      fetchSspai(),
    ]);

    const all = [...r1, ...r2, ...r3, ...hn, ...v2ex, ...ph, ...kr, ...sp];
    console.log(`\n📦 共抓取 ${all.length} 条`);

    // 去掉已在数据库里的 URL
    const existingUrls = new Set(
      fs.existsSync(IDEAS_FILE)
        ? JSON.parse(fs.readFileSync(IDEAS_FILE, 'utf-8')).map(i => i.url)
        : []
    );
    const candidates = all.filter(p => p.url && !existingUrls.has(p.url));
    console.log(`🔍 去重后 ${candidates.length} 条新内容\n`);

    // ── Step 2：AI 预筛 ──────────────────────────────────────────────────────
    console.log('⚡ AI预筛中（qwen-turbo）...');
    qualified = [];
    let passed = 0, failed = 0;
    for (const post of candidates) {
      const ok = await preFilter(post);
      if (ok) { process.stdout.write('✓'); qualified.push(post); passed++; }
      else    { process.stdout.write('✗'); failed++; }
      await sleep(120);
    }
    console.log(`\n✅ 通过预筛: ${passed}  ❌ 过滤: ${failed}`);
    fs.writeFileSync(CACHE, JSON.stringify(qualified, null, 2), 'utf-8');
  }

  // ── Step 3：深度分析 ──────────────────────────────────────────────────────
  console.log(`\n🧠 深度分析 ${qualified.length} 条（qwen-plus）...\n`);

  const sourceMap = { Reddit: 'reddit', HackerNews: 'hackernews', V2EX: 'v2ex', ProductHunt: 'producthunt', '36氪': '36kr', '少数派': 'sspai' };
  const analyzed = [];

  for (let i = 0; i < qualified.length; i++) {
    const post = qualified[i];
    console.log(`[${i + 1}/${qualified.length}] [${post.platform}] ${post.title.slice(0, 50)}`);

    const result = await analyzeWithQwen(post);
    if (!result) { console.log('  ⬜ 跳过（解析失败）\n'); continue; }

    analyzed.push({
      id: `${(sourceMap[post.platform] || post.platform.toLowerCase())}-${post.url.split('/').pop() || Date.now()}-${i}`,
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
