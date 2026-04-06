/**
 * 创意雷达 — 本地抓取控制台
 *
 * 用法：
 *   node scripts/server.js        # 默认 3001 端口
 *   PORT=3002 node scripts/server.js
 *
 * 功能：
 *   - 选择手动抓取来源（小红书 / 知乎）
 *   - 填写关键词和页数
 *   - 一键启动，实时查看日志
 *   - 自动检测 Chrome CDP 是否已启动
 */

const http    = require('http');
const url     = require('url');
const { spawn } = require('child_process');
const path    = require('path');
const net     = require('net');

const PORT = parseInt(process.env.PORT || '3001', 10);
const SCRIPT = path.join(__dirname, 'manual-cdp.js');

// ── CDP 连通性检测 ────────────────────────────────────────────────────────────

function checkCdpPort(port) {
  return new Promise(resolve => {
    const sock = net.createConnection({ port, host: '127.0.0.1' });
    sock.setTimeout(1500);
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error', () => resolve(false));
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

// ── HTML 控制台页面 ──────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>创意雷达 · 抓取控制台</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f1117;
    --panel: #1a1d27;
    --border: #2a2d3a;
    --accent: #6c63ff;
    --accent2: #ff6b6b;
    --text: #e2e4ef;
    --muted: #6b7280;
    --green: #34d399;
    --yellow: #fbbf24;
    --red: #f87171;
  }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, 'SF Pro Text', sans-serif; min-height: 100vh; }

  header { padding: 20px 32px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
  header h1 { font-size: 18px; font-weight: 600; }
  header span { font-size: 22px; }
  header small { color: var(--muted); font-size: 13px; margin-left: 8px; }

  .layout { display: grid; grid-template-columns: 340px 1fr; gap: 0; height: calc(100vh - 65px); }

  /* ── 左侧控制区 ── */
  .ctrl { padding: 24px; border-right: 1px solid var(--border); overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }

  .section-title { font-size: 11px; font-weight: 600; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 10px; }

  /* 来源卡片 */
  .source-grid { display: flex; flex-direction: column; gap: 8px; }
  .source-card {
    border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px;
    cursor: pointer; transition: all .15s; display: flex; align-items: flex-start; gap: 12px;
  }
  .source-card:hover { border-color: var(--accent); }
  .source-card.selected { border-color: var(--accent); background: rgba(108,99,255,.1); }
  .source-card.manual-tag::before {
    content: '需登录'; font-size: 10px; font-weight: 600; color: var(--yellow);
    background: rgba(251,191,36,.12); border: 1px solid rgba(251,191,36,.25);
    border-radius: 4px; padding: 1px 6px; display: inline-block; margin-bottom: 4px;
  }
  .source-card .icon { font-size: 26px; line-height: 1; }
  .source-card .info { flex: 1; }
  .source-card .name { font-weight: 600; font-size: 15px; }
  .source-card .desc { font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.5; }
  .source-card .auto-tag { font-size: 10px; color: var(--green); background: rgba(52,211,153,.1); border: 1px solid rgba(52,211,153,.25); border-radius: 4px; padding: 1px 6px; display: inline-block; margin-bottom: 4px; }

  /* 表单 */
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label { font-size: 12px; color: var(--muted); font-weight: 500; }
  .field input, .field select {
    background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
    padding: 10px 12px; color: var(--text); font-size: 14px; width: 100%;
    transition: border-color .15s;
  }
  .field input:focus, .field select:focus { outline: none; border-color: var(--accent); }

  /* CDP 状态 */
  .cdp-status { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 12px 14px; border-radius: 8px; border: 1px solid var(--border); }
  .cdp-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .cdp-dot.ok { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .cdp-dot.err { background: var(--red); }
  .cdp-dot.checking { background: var(--yellow); animation: pulse .8s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  .cdp-cmd { font-size: 11px; color: var(--muted); font-family: monospace; margin-top: 6px; line-height: 1.6; }

  /* 按钮 */
  .run-btn {
    width: 100%; padding: 13px; border-radius: 10px; border: none; cursor: pointer;
    font-size: 15px; font-weight: 600; background: var(--accent); color: #fff;
    transition: all .15s; letter-spacing: .02em;
  }
  .run-btn:hover:not(:disabled) { background: #7c74ff; transform: translateY(-1px); }
  .run-btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
  .run-btn.running { background: var(--accent2); }

  /* ── 右侧日志区 ── */
  .log-area { display: flex; flex-direction: column; }
  .log-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .log-header h2 { font-size: 14px; font-weight: 600; color: var(--muted); }
  .log-stats { display: flex; gap: 16px; }
  .stat { font-size: 12px; }
  .stat span { font-weight: 700; }
  .stat.added span { color: var(--green); }
  .stat.filtered span { color: var(--muted); }
  .log-body {
    flex: 1; overflow-y: auto; padding: 16px 20px;
    font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; line-height: 1.7;
  }
  .log-line { white-space: pre-wrap; word-break: break-all; }
  .log-line.err { color: var(--red); }
  .log-line.ok { color: var(--green); }
  .log-line.warn { color: var(--yellow); }
  .log-line.dim { color: var(--muted); }
  .empty-state { color: var(--muted); font-size: 14px; text-align: center; margin-top: 80px; }
  .empty-state p { margin-top: 8px; font-size: 12px; }
</style>
</head>
<body>
<header>
  <span>🎯</span>
  <div><h1>创意雷达 · 抓取控制台 <small>手动 CDP 模式</small></h1></div>
</header>

<div class="layout">
  <!-- 左侧控制区 -->
  <aside class="ctrl">

    <div>
      <div class="section-title">选择来源</div>
      <div class="source-grid">
        <!-- 手动来源 -->
        <div class="source-card manual-tag selected" data-source="xhs" onclick="selectSource(this)">
          <div class="icon">📕</div>
          <div class="info">
            <div class="name">小红书</div>
            <div class="desc">按关键词搜索笔记，需已登录账号</div>
          </div>
        </div>
        <div class="source-card manual-tag" data-source="zhihu" onclick="selectSource(this)">
          <div class="icon">🔵</div>
          <div class="info">
            <div class="name">知乎</div>
            <div class="desc">按关键词搜索问题/回答，需已登录账号</div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <div class="section-title">自动抓取来源（参考）</div>
      <div class="source-grid">
        <div class="source-card" style="cursor:default;opacity:.6">
          <div class="icon">🌐</div>
          <div class="info">
            <div class="auto-tag">每日自动</div>
            <div class="name" style="font-size:13px">Reddit · HN · V2EX · ProductHunt · 36氪 · 少数派</div>
            <div class="desc">由 GitHub Actions 每天 8:00 自动运行</div>
          </div>
        </div>
      </div>
    </div>

    <div class="field">
      <label>搜索关键词</label>
      <input id="query" type="text" value="痛点" placeholder="如：痛点、效率工具、一人公司…">
    </div>

    <div class="field">
      <label>滚动页数（每页约 10-20 条）</label>
      <input id="pages" type="number" min="1" max="10" value="3">
    </div>

    <div class="field">
      <label>Chrome CDP 端口</label>
      <input id="port" type="number" value="9222">
    </div>

    <div>
      <div class="section-title">Chrome 状态</div>
      <div class="cdp-status" id="cdpStatus">
        <div class="cdp-dot checking" id="cdpDot"></div>
        <div id="cdpText">检测中…</div>
      </div>
      <div class="cdp-cmd" id="cdpCmd"></div>
    </div>

    <button class="run-btn" id="runBtn" onclick="startScrape()" disabled>
      ▶ 开始抓取
    </button>

  </aside>

  <!-- 右侧日志区 -->
  <main class="log-area">
    <div class="log-header">
      <h2>运行日志</h2>
      <div class="log-stats">
        <div class="stat added">新增 <span id="statAdded">—</span> 条</div>
        <div class="stat filtered">过滤 <span id="statFiltered">—</span> 条</div>
      </div>
    </div>
    <div class="log-body" id="logBody">
      <div class="empty-state">🎯 等待运行…<p>选择来源、填写关键词，点击「开始抓取」</p></div>
    </div>
  </main>
</div>

<script>
let selectedSource = 'xhs';
let es = null;
let cdpTimer = null;

function selectSource(el) {
  document.querySelectorAll('.source-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedSource = el.dataset.source;
}

// ── CDP 状态轮询 ──────────────────────────────────────────────────────────────

async function checkCdp() {
  const port = document.getElementById('port').value || 9222;
  const dot  = document.getElementById('cdpDot');
  const txt  = document.getElementById('cdpText');
  const cmd  = document.getElementById('cdpCmd');
  const btn  = document.getElementById('runBtn');

  dot.className = 'cdp-dot checking';
  txt.textContent = '检测中…';

  try {
    const res = await fetch('/check-cdp?port=' + port, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    if (data.ok) {
      dot.className = 'cdp-dot ok';
      txt.textContent = 'Chrome 已连接（端口 ' + port + '）';
      cmd.textContent = '';
      btn.disabled = false;
    } else {
      throw new Error('not connected');
    }
  } catch {
    dot.className = 'cdp-dot err';
    txt.textContent = 'Chrome 未启动，请先运行：';
    cmd.innerHTML = '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\\\<br>&nbsp;&nbsp;--remote-debugging-port=' + port + ' \\\\<br>&nbsp;&nbsp;--user-data-dir=/tmp/cdp-chrome';
    btn.disabled = true;
  }
}

document.getElementById('port').addEventListener('change', checkCdp);
checkCdp();
cdpTimer = setInterval(checkCdp, 5000);

// ── 日志渲染 ──────────────────────────────────────────────────────────────────

function classifyLine(text) {
  if (text.includes('❌') || text.includes('Error') || text.includes('错误')) return 'err';
  if (text.includes('✅') || text.includes('🎉') || text.includes('完成')) return 'ok';
  if (text.includes('⚠️') || text.includes('warn')) return 'warn';
  if (text.startsWith('  ✓') || text.startsWith('  ✗')) return 'dim';
  return '';
}

function appendLog(text) {
  const body = document.getElementById('logBody');
  const line = document.createElement('div');
  line.className = 'log-line ' + classifyLine(text);
  line.textContent = text;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;

  // 提取统计数字
  const addedMatch = text.match(/新增\\s+(\\d+)\\s*条/);
  if (addedMatch) document.getElementById('statAdded').textContent = addedMatch[1];
  const passedMatch = text.match(/通过预筛:\\s*(\\d+)/);
  if (passedMatch) document.getElementById('statFiltered').textContent = '已过滤';
}

// ── 启动抓取 ──────────────────────────────────────────────────────────────────

function startScrape() {
  if (es) { es.close(); es = null; }

  const query  = encodeURIComponent(document.getElementById('query').value.trim() || '痛点');
  const pages  = document.getElementById('pages').value || 3;
  const port   = document.getElementById('port').value || 9222;
  const source = selectedSource;

  document.getElementById('logBody').innerHTML = '';
  document.getElementById('statAdded').textContent = '—';
  document.getElementById('statFiltered').textContent = '—';

  const btn = document.getElementById('runBtn');
  btn.textContent = '⏸ 运行中…';
  btn.classList.add('running');
  btn.disabled = true;

  const evtUrl = '/scrape?source=' + source + '&query=' + query + '&pages=' + pages + '&port=' + port;
  es = new EventSource(evtUrl);

  es.addEventListener('log', e => appendLog(e.data));
  es.addEventListener('done', () => {
    es.close(); es = null;
    btn.textContent = '▶ 再次抓取';
    btn.classList.remove('running');
    btn.disabled = false;
  });
  es.addEventListener('error', () => {
    appendLog('❌ 连接中断');
    es.close(); es = null;
    btn.textContent = '▶ 重试';
    btn.classList.remove('running');
    btn.disabled = false;
  });
}
</script>
</body>
</html>`;

// ── HTTP 路由 ─────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const q = parsed.query;

  // GET / → 控制台页面
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  // GET /check-cdp?port=9222
  if (pathname === '/check-cdp') {
    const port = parseInt(q.port || '9222', 10);
    const ok = await checkCdpPort(port);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok }));
    return;
  }

  // GET /scrape?source=xhs&query=...&pages=3&port=9222  → SSE
  if (pathname === '/scrape') {
    const source = q.source || 'xhs';
    const query  = decodeURIComponent(q.query || '痛点');
    const pages  = q.pages  || '3';
    const port   = q.port   || '9222';

    res.writeHead(200, {
      'Content-Type':  'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${data.replace(/\n/g, '\\n')}\n\n`);
    };

    send('log', `🚀 启动抓取：[${source}] 关键词="${query}" 页数=${pages}`);

    const child = spawn(process.execPath, [
      SCRIPT,
      '--source', source,
      '--query',  query,
      '--pages',  pages,
      '--port',   port,
    ], { cwd: path.dirname(__dirname) });

    let buf = '';
    const flush = (stream) => {
      stream.on('data', chunk => {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop(); // 保留未完成的行
        for (const line of lines) {
          if (line.trim()) send('log', line);
        }
      });
    };
    flush(child.stdout);
    flush(child.stderr);

    child.on('close', code => {
      if (buf.trim()) send('log', buf.trim());
      send('log', code === 0 ? '✅ 脚本完成' : `⚠️ 退出码 ${code}`);
      send('done', 'ok');
      res.end();
    });

    req.on('close', () => {
      child.kill();
    });

    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🎯 创意雷达控制台已启动`);
  console.log(`   打开浏览器：http://localhost:${PORT}\n`);
});
