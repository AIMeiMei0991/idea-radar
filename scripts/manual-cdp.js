/**
 * 创意雷达 — 手动 CDP 抓取脚本
 * 适用于：小红书、知乎等需要登录态 / 反爬严格的网站
 *
 * 前提：
 *   1. 用以下命令启动 Chrome（首次设置，之后每次手动抓取都需要先启动）：
 *      /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
 *        --remote-debugging-port=9222 \
 *        --user-data-dir=/tmp/cdp-chrome
 *
 *   2. 在打开的 Chrome 里登录目标网站（小红书 / 知乎）
 *
 *   3. 运行本脚本：
 *      node scripts/manual-cdp.js --source xhs --query 痛点 --pages 3
 *      node scripts/manual-cdp.js --source zhihu --query 独立开发痛点 --pages 2
 *
 * 参数：
 *   --source   xhs | zhihu
 *   --query    搜索关键词（支持中文，如：痛点、一人公司、效率工具）
 *   --pages    滚动页数，每页约 10-20 条（默认 3）
 *   --port     CDP 端口（默认 9222）
 *   --no-ai    只抓取不分析（调试用）
 */

const puppeteer = require('puppeteer-core');

const { preFilter, analyzeWithQwen, sleep } = require('./lib/ai-analyze');
const { appendToIdeas }                     = require('./lib/write-ideas');

// ── 参数解析 ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const SOURCE  = arg('source', 'xhs');
const QUERY   = arg('query', '痛点');
const PAGES   = parseInt(arg('pages', '3'), 10);
const PORT    = parseInt(arg('port', '9222'), 10);
const NO_AI   = args.includes('--no-ai');

const DATE = new Date().toISOString().slice(0, 10);

// ── 来源配置 ──────────────────────────────────────────────────────────────────

const SOURCE_CONFIG = {
  xhs: {
    name: '小红书',
    searchUrl: (q) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}&type=51`,
    waitSelector: '.note-item, .search-result-item, section[class*="note"]',
    extract: extractXhsPosts,
    source: 'xiaohongshu',
    sourceLabel: '小红书',
  },
  zhihu: {
    name: '知乎',
    searchUrl: (q) => `https://www.zhihu.com/search?q=${encodeURIComponent(q)}&type=content`,
    waitSelector: '.ContentItem, .SearchResult-Card, .List-item',
    extract: extractZhihuPosts,
    source: 'zhihu',
    sourceLabel: '知乎',
  },
};

// ── DOM 提取：小红书 ──────────────────────────────────────────────────────────

async function extractXhsPosts(page) {
  return page.evaluate(() => {
    const posts = [];
    // 尝试多种可能的 selector（XHS 前端改版较频繁）
    const selectors = [
      '.note-item',
      'section.note-item',
      '[class*="note-item"]',
      '.search-result-item',
      '[data-v-id]',
    ];

    let cards = [];
    for (const sel of selectors) {
      cards = Array.from(document.querySelectorAll(sel));
      if (cards.length > 0) break;
    }

    for (const card of cards) {
      // 标题：尝试多种 selector
      const titleEl = card.querySelector('.title, .note-title, [class*="title"], span.name');
      const descEl  = card.querySelector('.desc, .note-desc, [class*="desc"], .content');
      const linkEl  = card.querySelector('a[href*="/explore/"], a[href*="/discovery/"]');

      const title = titleEl?.textContent?.trim() || '';
      const desc  = descEl?.textContent?.trim() || '';
      const href  = linkEl?.href || card.querySelector('a')?.href || '';

      if (!title && !desc) continue;
      const url = href.startsWith('http') ? href : (href ? `https://www.xiaohongshu.com${href}` : '');

      posts.push({ title: title || desc.slice(0, 40), body: desc, url });
    }
    return posts;
  });
}

// ── DOM 提取：知乎 ────────────────────────────────────────────────────────────

async function extractZhihuPosts(page) {
  return page.evaluate(() => {
    const posts = [];
    const selectors = [
      '.ContentItem',
      '.SearchResult-Card .ContentItem',
      '.List-item',
      '[itemscope]',
    ];

    let cards = [];
    for (const sel of selectors) {
      cards = Array.from(document.querySelectorAll(sel));
      if (cards.length > 0) break;
    }

    for (const card of cards) {
      const titleEl   = card.querySelector('.ContentItem-title, h2, .QuestionItem-title');
      const excerptEl = card.querySelector('.RichContent-inner, .ContentItem-excerpt, [itemprop="text"]');
      const linkEl    = card.querySelector('a[href*="/question/"], a[href*="/answer/"], a[href*="/zvideo/"]');

      const title   = titleEl?.textContent?.trim() || '';
      const excerpt = excerptEl?.textContent?.trim().slice(0, 500) || '';
      const href    = linkEl?.href || '';

      if (!title) continue;
      const url = href.startsWith('http') ? href : (href ? `https://www.zhihu.com${href}` : '');

      posts.push({ title, body: excerpt, url });
    }
    return posts;
  });
}

// ── 滚动加载更多 ──────────────────────────────────────────────────────────────

async function scrollAndCollect(page, config, targetPages) {
  const allPosts = new Map(); // url -> post（去重）

  for (let p = 0; p < targetPages; p++) {
    console.log(`  📜 第 ${p + 1}/${targetPages} 页...`);

    // 等待内容出现
    try {
      await page.waitForSelector(config.waitSelector, { timeout: 10000 });
    } catch {
      console.log('  ⚠️  等待元素超时，可能页面未完全加载或未登录');
    }

    await sleep(1500); // 等待懒加载图片/内容

    // 提取当前可见内容
    const posts = await config.extract(page);
    for (const post of posts) {
      if (post.url && !allPosts.has(post.url)) {
        allPosts.set(post.url, post);
      }
    }
    console.log(`  ✓ 累计 ${allPosts.size} 条（本页新增 ${posts.filter(p => p.url).length}）`);

    // 滚动到底部触发加载
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(2000);
  }

  return Array.from(allPosts.values()).filter(p => p.title || p.body);
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  const config = SOURCE_CONFIG[SOURCE];
  if (!config) {
    console.error(`❌ 不支持的来源: ${SOURCE}，可选: xhs, zhihu`);
    process.exit(1);
  }

  console.log(`\n🔌 连接 Chrome CDP (port ${PORT})...`);
  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: `http://localhost:${PORT}` });
  } catch (e) {
    console.error(`❌ 无法连接到 Chrome，请先运行：`);
    console.error(`   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\`);
    console.error(`     --remote-debugging-port=${PORT} --user-data-dir=/tmp/cdp-chrome`);
    process.exit(1);
  }

  const pages = await browser.pages();
  const page  = pages[0] || await browser.newPage();

  // 设置 User-Agent 避免被识别为无头浏览器
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  const url = config.searchUrl(QUERY);
  console.log(`🔍 搜索 [${config.name}]: "${QUERY}"`);
  console.log(`   URL: ${url}\n`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(2000); // 等待 JS 渲染

  // 抓取
  const rawPosts = await scrollAndCollect(page, config, PAGES);
  console.log(`\n📦 共抓取 ${rawPosts.length} 条原始帖子`);

  browser.disconnect(); // 断开 CDP 但不关闭 Chrome

  if (rawPosts.length === 0) {
    console.log('⚠️  未抓取到内容。可能原因：');
    console.log('   1. 未登录账号（请在 Chrome 里先登录）');
    console.log('   2. 网页 DOM 结构已更新（请提 issue）');
    console.log('   3. 被风控（换关键词或稍后再试）');
    process.exit(0);
  }

  // 格式化为 AI 分析所需格式
  const posts = rawPosts.map(p => ({
    platform: config.sourceLabel,
    title: p.title, body: p.body || '', comments: [],
    score: 0, numComments: 0,
    url: p.url || `${config.searchUrl(QUERY)}_${Date.now()}`,
  }));

  if (NO_AI) {
    console.log('\n[--no-ai] 跳过 AI 分析，输出原始抓取结果：');
    posts.forEach((p, i) => console.log(`${i + 1}. [${p.title}] ${p.url}`));
    return;
  }

  // ── AI 预筛 ────────────────────────────────────────────────────────────────
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
    console.log('⚠️  全部被预筛过滤，尝试换关键词（如：有没有好用的工具、一直找不到解决方案）');
    process.exit(0);
  }

  // ── 深度分析 ──────────────────────────────────────────────────────────────
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
  console.log(`\n💡 下次可以试试这些关键词：`);
  console.log(`   node scripts/manual-cdp.js --source ${SOURCE} --query 一人公司 --pages 3`);
  console.log(`   node scripts/manual-cdp.js --source ${SOURCE} --query 效率工具 --pages 3`);
  console.log(`   node scripts/manual-cdp.js --source ${SOURCE} --query 独立开发痛点 --pages 3`);
}

main().catch(e => {
  console.error('❌ 错误:', e.message);
  process.exit(1);
});
