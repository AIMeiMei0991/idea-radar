/**
 * 创意雷达 — 全网痛点抓取 + 通义千问分析 + 写入网站数据
 * node scripts/scrape_and_analyze.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const QWEN_KEY = 'sk-ea127923cf19456fb783bc11421fd255';
const qwen = new OpenAI({
  apiKey: QWEN_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

const DATE = new Date().toISOString().slice(0, 10);
const RAW_FILE = path.join(__dirname, `../public/data/raw_${DATE}.json`);
const IDEAS_FILE = path.join(__dirname, '../public/data/ideas.json');

// ── HTTP ──────────────────────────────────────────────

function get(url) {
  return new Promise(resolve => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 IdeaRadar/1.0' },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(12000, () => { req.destroy(); resolve(null); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── 抓取 ──────────────────────────────────────────────

async function scrapeReddit(query, pages = 3) {
  const results = [];
  let after = '';
  for (let i = 0; i < pages; i++) {
    const data = await get(`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=100&t=year${after ? '&after=' + after : ''}`);
    if (!data?.data?.children?.length) break;
    for (const p of data.data.children) {
      const d = p.data;
      results.push({ platform: 'Reddit', subreddit: d.subreddit, title: d.title, body: (d.selftext || '').slice(0, 800), score: d.score, url: `https://reddit.com${d.permalink}` });
    }
    after = data.data.after;
    if (!after) break;
    await sleep(600);
  }
  return results;
}

async function scrapeRedditSub(sub) {
  const results = [];
  let after = '';
  for (let i = 0; i < 5; i++) {
    const data = await get(`https://www.reddit.com/r/${sub}/new.json?limit=100${after ? '&after=' + after : ''}`);
    if (!data?.data?.children?.length) break;
    for (const p of data.data.children) {
      const d = p.data;
      results.push({ platform: 'Reddit', subreddit: sub, title: d.title, body: (d.selftext || '').slice(0, 800), score: d.score, url: `https://reddit.com${d.permalink}` });
    }
    after = data.data.after;
    if (!after) break;
    await sleep(500);
  }
  return results;
}

async function scrapeHN() {
  const results = [];
  for (const q of ["why isn't there", "i wish there was an app", "why hasn't anyone built", "why is there no tool"]) {
    for (let page = 0; page < 3; page++) {
      const data = await get(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=ask_hn&hitsPerPage=50&page=${page}`);
      if (!data?.hits?.length) break;
      for (const h of data.hits) {
        results.push({ platform: 'HackerNews', title: h.title, body: (h.story_text || '').replace(/<[^>]*>/g, '').slice(0, 800), score: h.points || 0, url: `https://news.ycombinator.com/item?id=${h.objectID}` });
      }
      await sleep(200);
    }
  }
  return results;
}

// ── 筛选 ──────────────────────────────────────────────

const NEED_WORDS = ['wish there was', 'why is there no', "why isn't there", "why hasn't anyone", 'nobody built', 'need an app', 'no good app', 'no tool for', 'does anyone know of an app', 'want an app that'];

function filter(posts) {
  const seen = new Set();
  return posts.filter(p => {
    if (seen.has(p.title)) return false;
    seen.add(p.title);
    const text = (p.title + ' ' + p.body).toLowerCase();
    return NEED_WORDS.some(w => text.includes(w)) && p.score >= 10 && p.body.length >= 30;
  });
}

// ── 通义千问分析 → 结构化 JSON ────────────────────────

async function analyzeWithQwen(p) {
  const prompt = `你是"创意雷达"产品分析师，帮助一人创业者发现可行的创业机会。

来源：${p.platform}（热度 ${p.score} 赞）
标题：${p.title}
正文：${p.body || '（无正文）'}

只返回 JSON，不要任何额外文字：

{
  "title": "用中文提炼创业机会标题（20字以内，具体有吸引力）",
  "score": 1到10的整数,
  "scoreReason": "一句话评分理由",
  "problem": "谁在痛？什么场景？为什么现有工具解决不了？（100字以内）",
  "targetUsers": "目标用户画像（50字以内）",
  "competitors": "国内外现有竞品及其不足（50字以内）",
  "soloFit": "yes或maybe或no",
  "soloReason": "一人能做吗？技术栈？MVP周期？（60字以内）",
  "chinaFit": "high或medium或low",
  "chinaReason": "中国市场需求规模（50字以内）",
  "chinaGap": "国内市场空白点（50字以内）",
  "mvp": "最小可行产品核心功能（60字以内）",
  "coldStart": "冷启动获取前100用户的方法（50字以内）",
  "category": "AI工具或效率工具或金融工具或教育或健康或本地服务或开发者工具或其他"
}`;

  try {
    const res = await qwen.chat.completions.create({
      model: 'qwen-plus',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 700,
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

// ── 写入 ideas.json ───────────────────────────────────

function appendToIdeas(newItems) {
  let existing = [];
  if (fs.existsSync(IDEAS_FILE)) {
    existing = JSON.parse(fs.readFileSync(IDEAS_FILE, 'utf-8'));
  }
  const existingUrls = new Set(existing.map(i => i.url));
  const toAdd = newItems.filter(i => i.url && !existingUrls.has(i.url));
  const updated = [...existing, ...toAdd];
  fs.writeFileSync(IDEAS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return toAdd.length;
}

// ── 主流程 ────────────────────────────────────────────

async function main() {
  let filtered;

  if (fs.existsSync(RAW_FILE)) {
    console.log(`📂 加载已有数据: ${RAW_FILE}`);
    filtered = JSON.parse(fs.readFileSync(RAW_FILE, 'utf-8'));
  } else {
    console.log('🚀 抓取中...');
    const [hn, r1, r2, r3, r4, r5, r6] = await Promise.all([
      scrapeHN(),
      scrapeReddit('wish there was an app for', 3),
      scrapeReddit('why is there no app that', 3),
      scrapeReddit("why hasn't anyone built", 2),
      scrapeRedditSub('needanapp'),
      scrapeRedditSub('AppIdeas'),
      scrapeRedditSub('SomebodyMakeThis'),
    ]);
    const all = [...hn, ...r1, ...r2, ...r3, ...r4, ...r5, ...r6];
    filtered = filter(all);
    console.log(`📦 原始 ${all.length} 条 → 筛选后 ${filtered.length} 条`);
    fs.writeFileSync(RAW_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
  }

  const toAnalyze = filtered.sort((a, b) => b.score - a.score).slice(0, 50);
  console.log(`\n🧠 通义千问分析 ${toAnalyze.length} 条...\n`);

  const analyzed = [];
  for (let i = 0; i < toAnalyze.length; i++) {
    const p = toAnalyze[i];
    process.stdout.write(`[${i + 1}/${toAnalyze.length}] ${p.title.slice(0, 45)}\n`);
    const result = await analyzeWithQwen(p);
    if (!result) { process.stdout.write('  ⬜ 跳过\n'); continue; }

    // 补全网站所需字段
    const idea = {
      id: `reddit-hn-${Date.now()}-${i}`,
      ...result,
      desc: `来自 ${p.platform}，热度 ${p.score} 赞`,
      url: p.url,
      source: p.platform === 'Reddit' ? 'reddit' : 'hackernews',
      sourceLabel: p.platform === 'Reddit' ? 'Reddit' : 'HackerNews',
      fetchedAt: new Date().toISOString(),
      dateKey: DATE,
      views: p.score,
    };
    analyzed.push(idea);
    process.stdout.write(`  ✅ ${result.title} [${result.score}分]\n`);
    await sleep(500);
  }

  const added = appendToIdeas(analyzed);
  console.log(`\n🎉 完成！新增 ${added} 条到网站数据`);
  console.log(`📁 ${IDEAS_FILE}`);
}

main().catch(console.error);
