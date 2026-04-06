/**
 * 创意雷达 — 手动抓取脚本（基于 web-access CDP Proxy）
 *
 * 前置：
 *   1. 确保 web-access skill 的 CDP Proxy 已启动（proxy 监听 localhost:3456）
 *      node ~/.claude/plugins/marketplaces/web-access/scripts/check-deps.mjs
 *
 *   2. 在 Chrome 里登录目标网站
 *
 *   3. 运行：
 *      node scripts/manual-cdp.js --source xhs --query 痛点 --pages 3
 *      node scripts/manual-cdp.js --source zhihu --query 独立开发痛点 --pages 2
 *
 * 参数：
 *   --source   xhs | zhihu
 *   --query    搜索关键词
 *   --pages    滚动次数（默认 3）
 *   --no-ai    只抓取不分析
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const { preFilter, analyzeWithQwen, sleep } = require('./lib/ai-analyze');
const { appendToIdeas }                     = require('./lib/write-ideas');

const PROXY = 'http://localhost:3456';
const SKILL_CHECK = path.join(
  process.env.HOME || '/Users/' + require('os').userInfo().username,
  '.claude/plugins/marketplaces/web-access/scripts/check-deps.mjs'
);

// ── 参数解析 ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const SOURCE = arg('source', 'xhs');
const QUERY  = arg('query', '痛点');
const PAGES  = parseInt(arg('pages', '3'), 10);
const NO_AI  = args.includes('--no-ai');
const DATE   = new Date().toISOString().slice(0, 10);

// ── Proxy HTTP 工具 ───────────────────────────────────────────────────────────

function proxyGet(path) {
  return new Promise((resolve, reject) => {
    http.get(PROXY + path, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
      });
    }).on('error', reject);
  });
}

function proxyPost(path, body) {
  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(body, 'utf-8');
    const opts = {
      hostname: 'localhost', port: 3456,
      path, method: 'POST',
      headers: { 'Content-Length': bodyBuf.length },
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
      });
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

// JS 脚本写到临时文件再 POST，避免多行/特殊字符问题
function evalScript(targetId, script) {
  const tmp = `/tmp/cdp-eval-${Date.now()}.js`;
  fs.writeFileSync(tmp, script, 'utf-8');
  return new Promise((resolve, reject) => {
    const bodyBuf = fs.readFileSync(tmp);
    const opts = {
      hostname: 'localhost', port: 3456,
      path: `/eval?target=${targetId}`,
      method: 'POST',
      headers: { 'Content-Length': bodyBuf.length },
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
        try { fs.unlinkSync(tmp); } catch {}
      });
    });
    req.on('error', e => { reject(e); try { fs.unlinkSync(tmp); } catch {} });
    req.write(bodyBuf);
    req.end();
  });
}

// ── 来源配置 ──────────────────────────────────────────────────────────────────

const SOURCE_CONFIG = {
  xhs: {
    name: '小红书',
    searchUrl: q => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}&type=51`,
    waitMs: 3000, // 等 skeleton 消失
    extract: extractXhsPosts,
    source: 'xiaohongshu',
    sourceLabel: '小红书',
  },
  zhihu: {
    name: '知乎',
    searchUrl: q => `https://www.zhihu.com/search?q=${encodeURIComponent(q)}&type=content`,
    waitMs: 2000,
    extract: extractZhihuPosts,
    source: 'zhihu',
    sourceLabel: '知乎',
  },
};

// ── DOM 提取：小红书 ──────────────────────────────────────────────────────────
// 选择器来自 web-access site-patterns/xiaohongshu.com.md（2026-04-06 验证）

async function extractXhsPosts(targetId) {
  const result = await evalScript(targetId, `
(function() {
  var cards = Array.from(document.querySelectorAll('.note-item'));
  var posts = [];
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var titleEl = card.querySelector('a.title span');
    var coverEl = card.querySelector('a.cover');
    var title = titleEl ? titleEl.textContent.trim() : '';
    var href  = coverEl ? coverEl.getAttribute('href') : '';
    if (!title || !href) continue;
    var url = 'https://www.xiaohongshu.com' + href;
    posts.push({ title: title, body: '', url: url });
  }
  return JSON.stringify(posts);
})()
`);
  // proxy 返回 { value: "JSON字符串" }
  const raw = result?.value ?? result;
  try { return JSON.parse(raw); } catch { return []; }
}

// ── DOM 提取：知乎 ────────────────────────────────────────────────────────────

async function extractZhihuPosts(targetId) {
  const result = await evalScript(targetId, `
(function() {
  var selectors = ['.ContentItem', '.SearchResult-Card .ContentItem', '.List-item'];
  var cards = [];
  for (var s = 0; s < selectors.length; s++) {
    cards = Array.from(document.querySelectorAll(selectors[s]));
    if (cards.length > 0) break;
  }
  var posts = [];
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var titleEl   = card.querySelector('.ContentItem-title, h2, .QuestionItem-title');
    var excerptEl = card.querySelector('.RichContent-inner, .ContentItem-excerpt');
    var linkEl    = card.querySelector('a[href*="/question/"], a[href*="/answer/"]');
    var title   = titleEl   ? titleEl.textContent.trim() : '';
    var excerpt = excerptEl ? excerptEl.textContent.trim().slice(0, 500) : '';
    var href    = linkEl    ? linkEl.getAttribute('href') : '';
    if (!title) continue;
    var url = href.startsWith('http') ? href : 'https://www.zhihu.com' + href;
    posts.push({ title: title, body: excerpt, url: url });
  }
  return JSON.stringify(posts);
})()
`);
  const raw = result?.value ?? result;
  try { return JSON.parse(raw); } catch { return []; }
}

// ── 检查 Proxy 是否可用 ───────────────────────────────────────────────────────

async function checkProxy() {
  try {
    await proxyGet('/targets');
    return true;
  } catch {
    return false;
  }
}

// ── 滚动并收集 ────────────────────────────────────────────────────────────────

async function scrollAndCollect(targetId, config, targetPages) {
  const allPosts = new Map();

  await sleep(config.waitMs); // 等待初始渲染

  for (let p = 0; p < targetPages; p++) {
    console.log(`  📜 第 ${p + 1}/${targetPages} 页...`);

    const posts = await config.extract(targetId);
    for (const post of posts) {
      if (post.url && !allPosts.has(post.url)) {
        allPosts.set(post.url, post);
      }
    }
    console.log(`  ✓ 累计 ${allPosts.size} 条`);

    // 滚动到底触发懒加载
    await proxyGet(`/scroll?target=${targetId}&direction=bottom`);
    await sleep(2000);
  }

  return Array.from(allPosts.values()).filter(p => p.title);
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  const config = SOURCE_CONFIG[SOURCE];
  if (!config) {
    console.error(`❌ 不支持的来源: ${SOURCE}，可选: xhs, zhihu`);
    process.exit(1);
  }

  // 检查 Proxy
  console.log('\n🔌 检查 web-access CDP Proxy (localhost:3456)...');
  const proxyOk = await checkProxy();
  if (!proxyOk) {
    console.error('❌ CDP Proxy 未运行，请先执行：');
    console.error(`   node ${SKILL_CHECK}`);
    process.exit(1);
  }
  console.log('   ✓ Proxy 已连接\n');

  // 打开搜索页（新后台 tab）
  const searchUrl = config.searchUrl(QUERY);
  console.log(`🔍 搜索 [${config.name}]: "${QUERY}"`);
  console.log(`   URL: ${searchUrl}\n`);

  const tabInfo = await proxyGet(`/new?url=${encodeURIComponent(searchUrl)}`);
  const targetId = tabInfo?.targetId || tabInfo?.id;
  if (!targetId) {
    console.error('❌ 无法创建新 Tab，请确认 Chrome 已连接 CDP');
    process.exit(1);
  }
  console.log(`   Tab ID: ${targetId}`);

  // 抓取
  let rawPosts;
  try {
    rawPosts = await scrollAndCollect(targetId, config, PAGES);
  } finally {
    // 关闭我们创建的 tab，不影响用户其他 tab
    await proxyGet(`/close?target=${targetId}`).catch(() => {});
  }

  console.log(`\n📦 共抓取 ${rawPosts.length} 条原始帖子`);

  if (rawPosts.length === 0) {
    console.log('⚠️  未抓取到内容。可能原因：');
    console.log('   1. 未在 Chrome 中登录账号');
    console.log('   2. 页面选择器已更新（请提 issue）');
    console.log('   3. 被风控（换关键词或稍后再试）');
    process.exit(0);
  }

  // 格式化
  const posts = rawPosts.map(p => ({
    platform: config.sourceLabel,
    title: p.title, body: p.body || '', comments: [],
    score: 0, numComments: 0,
    url: p.url,
  }));

  if (NO_AI) {
    console.log('\n[--no-ai] 跳过 AI 分析，原始结果：');
    posts.forEach((p, i) => console.log(`${i + 1}. [${p.title}] ${p.url}`));
    return;
  }

  // AI 预筛
  console.log(`\n⚡ AI预筛 ${posts.length} 条...`);
  const qualified = [];
  for (const post of posts) {
    const ok = await preFilter(post);
    process.stdout.write(ok ? '✓' : '✗');
    if (ok) qualified.push(post);
    await sleep(120);
  }
  console.log(`\n✅ 通过预筛: ${qualified.length}/${posts.length}`);

  if (qualified.length === 0) {
    console.log('⚠️  全部被过滤，换关键词试试：生活痛点、工作效率痛点、有没有更好的工具');
    process.exit(0);
  }

  // 深度分析
  console.log(`\n🧠 深度分析 ${qualified.length} 条...\n`);
  const analyzed = [];
  for (let i = 0; i < qualified.length; i++) {
    const post = qualified[i];
    console.log(`[${i + 1}/${qualified.length}] ${post.title.slice(0, 50)}`);
    const result = await analyzeWithQwen(post);
    if (!result) { console.log('  ⬜ 跳过\n'); continue; }

    analyzed.push({
      id: `${SOURCE}-manual-${DATE}-${i}`,
      ...result,
      desc: `来自 ${config.sourceLabel} 搜索"${QUERY}"`,
      url: post.url,
      source: config.source,
      sourceLabel: config.sourceLabel,
      fetchedAt: new Date().toISOString(),
      dateKey: DATE,
      views: 0,
    });
    console.log(`  ✅ ${result.title} [${result.score}分]\n`);
    await sleep(500);
  }

  const added = appendToIdeas(analyzed);
  console.log(`\n🎉 完成！新增 ${added} 条高质量数据`);
}

main().catch(e => {
  console.error('❌ 错误:', e.message);
  process.exit(1);
});
