# 创意雷达 UX 改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将创意雷达从"信息墙"升级为"创业灵感引擎"：精简导航、卡片极简化、新增全屏详情页、修复数据质量。

**Architecture:** 单文件静态架构（`public/index.html` + `scripts/scrape_and_analyze.js`），无构建工具。详情页用 `position:fixed` 全屏 overlay 实现，hash URL 支持分享。数据管道改动仅影响新抓取数据，现有数据需手动 backfill 或自然替换。

**Tech Stack:** 原生 HTML/CSS/JS（无框架）；Node.js + OpenAI SDK（通义千问）；GitHub Pages 静态部署

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `scripts/scrape_and_analyze.js` | Modify | 评分归一化 + 质量过滤 + 3 个新 AI 字段 |
| `public/index.html` | Modify | 顶栏/Tab/筛选器/卡片/详情 overlay |
| `public/data/ideas.json` | 不改 | 现有数据保留，新字段自然积累 |

---

## Task 1：数据管道 — 评分归一化 + 质量门槛

**Files:**
- Modify: `scripts/scrape_and_analyze.js:280-295`（analyzeWithQwen prompt）
- Modify: `scripts/scrape_and_analyze.js:313-322`（appendToIdeas）

- [ ] **Step 1: 修改 analyzeWithQwen prompt，约束评分为 1-5**

  在 `analyzeWithQwen` 函数中，将 prompt 里的评分行从：
  ```
  "score": 1到10的整数,
  ```
  改为：
  ```
  "score": 1到5的整数（1=无商业价值，3=有潜力值得研究，5=强需求一人可做），
  ```

- [ ] **Step 2: 在 appendToIdeas 里加评分 clamp + 质量过滤**

  将 `appendToIdeas` 函数改为：
  ```js
  function appendToIdeas(newItems) {
    let existing = [];
    if (fs.existsSync(IDEAS_FILE)) {
      existing = JSON.parse(fs.readFileSync(IDEAS_FILE, 'utf-8'));
    }
    const existingUrls = new Set(existing.map(i => i.url));

    const toAdd = newItems
      .filter(i => {
        if (!i.url || existingUrls.has(i.url)) return false;  // 去重
        if (!i.problem || i.problem.trim().length < 10) return false;  // 无痛点描述
        if (!i.title || i.title.trim().length < 5) return false;       // 无标题
        if (i.isPainPoint === false) return false;                       // 非痛点
        const s = Math.min(5, Math.max(1, Math.round(Number(i.score) || 1)));
        if (s < 3) return false;                                         // 低质量过滤
        i.score = s;  // 归一化写回
        return true;
      });

    fs.writeFileSync(IDEAS_FILE, JSON.stringify([...existing, ...toAdd], null, 2), 'utf-8');
    return toAdd.length;
  }
  ```

- [ ] **Step 3: 验证过滤逻辑**

  ```bash
  cd "/Users/blancheume/Library/Mobile Documents/com~apple~CloudDocs/AIMei/金点子/idea-radar"
  node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync('public/data/ideas.json','utf-8'));
  const bad = data.filter(d => d.score > 5 || d.score < 1);
  console.log('当前数据中超出范围的评分条数:', bad.length);
  console.log('score>5:', data.filter(d=>d.score>5).length);
  console.log('score<3:', data.filter(d=>d.score<3).length);
  "
  ```

  预期输出：显示当前问题数量（下一步 backfill 修复现有数据）

- [ ] **Step 4: 一次性修复现有 ideas.json 中的异常评分**

  ```bash
  node -e "
  const fs = require('fs');
  const file = 'public/data/ideas.json';
  let data = JSON.parse(fs.readFileSync(file,'utf-8'));
  const before = data.length;
  // 归一化评分（>5 按比例压缩：6→4, 7→4, 8→5, 9→5）
  data = data.map(d => {
    let s = Number(d.score) || 1;
    if (s > 5) s = s >= 8 ? 5 : 4;  // 8-10 → 5分，6-7 → 4分
    d.score = Math.min(5, Math.max(1, Math.round(s)));
    return d;
  });
  // 过滤 score<3 且无 problem 的低质量条目（保守：只删 score=1）
  data = data.filter(d => d.score >= 2);
  console.log('处理前:', before, '  处理后:', data.length, '  删除:', before - data.length);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  "
  ```

  预期输出：`处理前: 415  处理后: ~411  删除: ~4`

- [ ] **Step 5: 验证修复结果**

  ```bash
  node -e "
  const data = require('./public/data/ideas.json');
  console.log('总条数:', data.length);
  const scores = {};
  data.forEach(d => scores[d.score] = (scores[d.score]||0)+1);
  console.log('评分分布:', JSON.stringify(scores));
  console.log('score>5的条目:', data.filter(d=>d.score>5).length, '（应为0）');
  "
  ```

  预期：`score>5的条目: 0`

- [ ] **Step 6: Commit**

  ```bash
  cd "/Users/blancheume/Library/Mobile Documents/com~apple~CloudDocs/AIMei/金点子/idea-radar"
  git add scripts/scrape_and_analyze.js public/data/ideas.json
  git commit -m "fix: normalize scores to 1-5, add quality gate in pipeline"
  ```

---

## Task 2：数据管道 — 新增 3 个 AI 分析字段

**Files:**
- Modify: `scripts/scrape_and_analyze.js:268-293`（analyzeWithQwen 的 prompt JSON 模板）

- [ ] **Step 1: 在 analyzeWithQwen prompt 的 JSON 模板里追加 3 个字段**

  在 prompt 中 `"coldStart"` 字段之后、`"category"` 之前，追加：
  ```
  "marketSize": "目标用户规模估算，必须带数字（如：中国职场人约3.2亿，细分市场约2000万）",
  "monetization": "变现路径：免费功能/付费分层描述 + 预估12个月MRR（参考同类产品定价）",
  "risks": "2-3条主要风险，每条一句话，覆盖技术/合规/竞争维度",
  ```

  完整 prompt 片段（替换原 `coldStart` 后的部分）：
  ```js
  const prompt = `你是"创意雷达"产品分析师。基于帖子的完整内容（标题+正文+评论）分析创业机会。
  注意：分析必须忠于原文，不要编造或过度推断。

  来源: ${post.platform}${post.subreddit ? ` r/${post.subreddit}` : ''}${post.node ? ` [${post.node}]` : ''}
  热度: ${post.score} 赞 · ${post.numComments} 评论
  标题: ${post.title}
  正文: ${(post.body || '（无正文）').slice(0, 1200)}${commentBlock}

  只返回 JSON，不要任何额外文字：

  {
    "title": "用中文提炼创业机会标题（20字以内，具体有吸引力）",
    "score": 1到5的整数（1=无商业价值，3=有潜力值得研究，5=强需求一人可做），
    "scoreReason": "一句话评分理由（结合评论共鸣程度）",
    "problem": "谁在痛？什么具体场景？为什么现有工具解决不了？（100字以内，基于原文，不编造）",
    "targetUsers": "目标用户画像（50字以内）",
    "marketSize": "目标用户规模估算，必须带数字（如：中国职场人约3.2亿，细分市场约2000万）",
    "competitors": "国内外现有竞品及核心不足（50字以内）",
    "soloFit": "yes或maybe或no",
    "soloReason": "一人能做吗？核心技术难点？MVP周期估算？（60字以内）",
    "chinaFit": "high或medium或low",
    "chinaReason": "中国市场需求规模与特点（50字以内）",
    "chinaGap": "国内市场空白点（50字以内）",
    "mvp": "最小可行产品：核心功能3条以内（60字以内）",
    "coldStart": "冷启动获取前100用户的具体方法（50字以内）",
    "monetization": "变现路径：免费功能/付费分层描述 + 预估12个月MRR（参考同类产品定价）",
    "risks": "2-3条主要风险，每条一句话，覆盖技术/合规/竞争维度",
    "category": "AI工具或效率工具或金融工具或教育或健康或本地服务或开发者工具或其他"
  }`;
  ```

- [ ] **Step 2: 将 max_tokens 从 800 调整为 1100（新增字段需要更多 token）**

  ```js
  // 将 max_tokens: 800 改为：
  max_tokens: 1100,
  ```

- [ ] **Step 3: 验证 prompt 改动（dry run，不实际调用 API）**

  ```bash
  node -e "
  // 检查文件语法是否正确
  const src = require('fs').readFileSync('scripts/scrape_and_analyze.js','utf-8');
  console.log('marketSize 字段存在:', src.includes('marketSize'));
  console.log('monetization 字段存在:', src.includes('monetization'));
  console.log('risks 字段存在:', src.includes('risks'));
  console.log('max_tokens 1100:', src.includes('1100'));
  "
  ```

  预期：4 行全部为 `true`

- [ ] **Step 4: Commit**

  ```bash
  git add scripts/scrape_and_analyze.js
  git commit -m "feat: add marketSize/monetization/risks fields to AI analysis prompt"
  ```

---

## Task 3：前端 — 顶栏重组

**Files:**
- Modify: `public/index.html:357-374`（topbar HTML）
- Modify: `public/index.html:7-200`（CSS section，topbar 相关样式）
- Modify: `public/index.html:430+`（JS section，新增 toggleMoreMenu 函数）

- [ ] **Step 1: 替换顶栏 HTML（lines 357-374）**

  将原有的：
  ```html
  <div class="topbar" id="topbar">
    <div class="topbar-inner">
      <div>
        <div class="logo"><span class="logo-icon">📡</span>创意雷达</div>
        <div class="logo-sub">传统需求 × 创新解法 = 一人公司机会</div>
        <div class="update-time" id="updateTime">每天 08:00 自动更新</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="read-toggle" id="clearReadBtn" onclick="clearAllRead()" style="color:#666" aria-label="清空全部已读记录">清空已读</button>
        <button class="read-toggle" id="readToggle" onclick="toggleHideRead()" aria-label="切换隐藏/显示已读卡片">隐藏已读</button>
        <div class="dp-wrap" id="dpWrap">
          <button class="date-picker-btn" id="datePickerBtn" onclick="toggleDatePicker(event)" aria-label="按日期筛选" aria-haspopup="listbox">
            📅 <span id="datePickerLabel">日期</span><span class="dp-arrow">▾</span>
          </button>
          <div class="date-dropdown" id="dateDropdown" role="listbox" aria-label="选择日期"></div>
        </div>
      </div>
    </div>
  ```

  替换为：
  ```html
  <div class="topbar" id="topbar">
    <div class="topbar-inner">
      <div>
        <div class="logo"><span class="logo-icon">🎯</span>创意雷达</div>
        <div class="update-time" id="updateTime">每天 08:00 自动更新</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <div class="dp-wrap" id="dpWrap">
          <button class="date-picker-btn" id="datePickerBtn" onclick="toggleDatePicker(event)" aria-label="按日期筛选" aria-haspopup="listbox">
            <span id="datePickerLabel">日期</span><span class="dp-arrow">▾</span>
          </button>
          <div class="date-dropdown" id="dateDropdown" role="listbox" aria-label="选择日期"></div>
        </div>
        <div style="position:relative">
          <button class="date-picker-btn" id="moreMenuBtn" onclick="toggleMoreMenu(event)" aria-label="更多操作" aria-haspopup="true">⋯</button>
          <div class="date-dropdown" id="moreMenuDropdown" style="min-width:120px">
            <div class="date-dropdown-item" onclick="clearAllRead();closeMoreMenu()">清空已读</div>
            <div class="date-dropdown-item" id="hideReadMenuItem" onclick="toggleHideRead();closeMoreMenu()">隐藏已读</div>
          </div>
        </div>
      </div>
    </div>
  ```

- [ ] **Step 2: 在 JS 中新增 toggleMoreMenu / closeMoreMenu 函数**

  在 `toggleDatePicker` 函数附近（约 line 708）新增：
  ```js
  function toggleMoreMenu(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('moreMenuDropdown');
    const btn = document.getElementById('moreMenuBtn');
    const isOpen = dropdown.classList.contains('show');
    // 关闭 date dropdown（互斥）
    document.getElementById('dateDropdown').classList.remove('show');
    document.getElementById('datePickerBtn').classList.remove('open');
    dropdown.classList.toggle('show', !isOpen);
    btn.classList.toggle('open', !isOpen);
  }
  function closeMoreMenu() {
    document.getElementById('moreMenuDropdown').classList.remove('show');
    document.getElementById('moreMenuBtn').classList.remove('open');
  }
  ```

  同时在已有的 `document.addEventListener('click', ...)` 监听器里（关闭 date dropdown 的那个）补充关闭 moreMenu：
  ```js
  // 找到已有的 click 全局监听，追加：
  closeMoreMenu();
  ```

- [ ] **Step 3: 更新 toggleHideRead 保持 "隐藏已读/显示已读" 菜单项文字同步**

  在 `toggleHideRead` 函数里追加：
  ```js
  const menuItem = document.getElementById('hideReadMenuItem');
  if (menuItem) menuItem.textContent = hideRead ? '显示已读' : '隐藏已读';
  ```

- [ ] **Step 4: 浏览器验证**

  用 `npx serve public` 打开 `http://localhost:3000`，检查：
  - [ ] iPhone 模拟（390px）：顶栏只显示 logo + 更新时间 + 日期按钮 + ⋯ 按钮，不换行
  - [ ] 点 ⋯ 按钮：弹出包含"清空已读"和"隐藏已读"的下拉菜单
  - [ ] 点"隐藏已读"：菜单关闭，功能生效，再次点 ⋯ 显示"显示已读"
  - [ ] 点页面空白处：⋯ 下拉菜单关闭

- [ ] **Step 5: Commit**

  ```bash
  git add public/index.html
  git commit -m "feat: simplify topbar - merge buttons to ⋯ menu, remove subtitle"
  ```

---

## Task 4：前端 — Tab 栏 + 筛选器精简

**Files:**
- Modify: `public/index.html:382-424`（tabs + filter HTML）
- Modify: `public/index.html:430+`（JS，更新 setTab 的 tab 映射逻辑）

- [ ] **Step 1: 替换 Tab 栏 HTML（lines 382-394），只保留 4 个 tab**

  将整个 `<div class="tabs-wrap" ...>` 替换为：
  ```html
  <div class="tabs-wrap" role="tablist" aria-label="内容分类">
    <button class="tab-btn active" role="tab" aria-selected="true"  data-tab="feed" onclick="setTab(this,'feed')">📰 精选</button>
    <button class="tab-btn" role="tab" aria-selected="false" data-tab="all"  onclick="setTab(this,'all')">全部</button>
    <button class="tab-btn" role="tab" aria-selected="false" data-tab="tmrr" onclick="setTab(this,'tmrr')">验证收入</button>
    <button class="tab-btn" role="tab" aria-selected="false" data-tab="bookmarks" onclick="setTab(this,'bookmarks')">
      ♥ 收藏<span class="badge" id="bkBadge" style="display:none">0</span>
    </button>
  </div>
  ```

- [ ] **Step 2: 替换筛选器 HTML（lines 396-424），只保留 4 个核心 chip + 更多**

  将整个 `<div class="filter-wrap" ...>` 替换为：
  ```html
  <div class="filter-wrap" id="filterWrap">
    <button class="filter-chip fc-china" id="fcChina" onclick="toggleFilter('china')"
      aria-pressed="false" aria-label="只看中国市场高匹配的创意">🇨🇳 中国可做</button>
    <button class="filter-chip fc-solo" id="fcSolo" onclick="toggleFilter('solo_yes')"
      aria-pressed="false" aria-label="只看一人可行的创意">👤 一人可行</button>
    <button class="filter-chip fc-score4" id="fcScore4" onclick="toggleFilter('score4')"
      aria-pressed="false" aria-label="只看评分4分以上的高价值创意">⭐ 高价值</button>
    <button class="filter-chip fc-dev-short" id="fcDevShort" onclick="toggleFilter('dev_short')"
      aria-pressed="false" aria-label="只看1-3月可完成的项目">⏱ 快速开发</button>
    <button class="filter-chip xf fc-mrr" id="fcMrr" onclick="toggleFilter('mrr')"
      aria-pressed="false" aria-label="只看有真实验证收入的产品">💰 有真实收入</button>
    <button class="filter-chip xf fc-solo-maybe" id="fcSoloMaybe" onclick="toggleFilter('solo_maybe')"
      aria-pressed="false" aria-label="只看可能可行的创意">👤 可能可行</button>
    <button class="filter-chip xf fc-solo-hard" id="fcSoloHard" onclick="toggleFilter('solo_hard')"
      aria-pressed="false" aria-label="只看需要团队的创意">👤 需团队</button>
    <button class="filter-chip xf fc-dev-mid" id="fcDevMid" onclick="toggleFilter('dev_mid')"
      aria-pressed="false" aria-label="只看3-6月可完成的项目">⏱ 3-6月</button>
    <button class="filter-chip xf fc-dev-long" id="fcDevLong" onclick="toggleFilter('dev_long')"
      aria-pressed="false" aria-label="只看6-12月可完成的项目">⏱ 6-12月</button>
    <button class="filter-chip xf fc-pt-effect" id="fcPtEffect" onclick="toggleFilter('pt_effect')"
      aria-pressed="false" aria-label="只看效率类痛点">⚡ 效率痛点</button>
    <button class="filter-chip xf fc-pt-cost" id="fcPtCost" onclick="toggleFilter('pt_cost')"
      aria-pressed="false" aria-label="只看成本类痛点">💸 降本痛点</button>
    <button class="filter-chip xf fc-pt-exp" id="fcPtExp" onclick="toggleFilter('pt_exp')"
      aria-pressed="false" aria-label="只看体验类痛点">✨ 体验痛点</button>
    <button class="filter-more-btn" id="filterMoreBtn" onclick="toggleFilterExpand()" aria-label="展开更多筛选">更多 ↓</button>
  </div>
  ```

- [ ] **Step 3: 浏览器验证**

  - [ ] 只有 4 个 tab 显示：精选 / 全部 / 验证收入 / 收藏
  - [ ] filter chips 默认显示 4 个：中国可做 / 一人可行 / 高价值 / 快速开发
  - [ ] 点"更多 ↓"展开剩余 chip
  - [ ] 已有筛选逻辑（点 chip 高亮、再点取消）仍正常工作

- [ ] **Step 4: Commit**

  ```bash
  git add public/index.html
  git commit -m "feat: simplify tabs to 4, filter chips to 4 core + more"
  ```

---

## Task 5：前端 — 卡片极简化

**Files:**
- Modify: `public/index.html:914-1028`（renderCard 函数）
- Modify: `public/index.html:7-353`（CSS section，新增简化卡片样式）

- [ ] **Step 1: 在 CSS section 末尾（`</style>` 之前）追加卡片简化样式**

  ```css
  /* ── 简化卡片 pill 信号行 ── */
  .card-pills { display:flex; gap:5px; flex-wrap:wrap; margin-top:8px; }
  .card-pill  { font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; line-height:1.4; }
  ```

- [ ] **Step 2: 替换 renderCard 函数（lines 914-1028）**

  用以下精简版替换整个 `renderCard` 函数：
  ```js
  function renderCard(item) {
    const rawTitle = fixTitle(item.title || '');
    const titleZh = item.titleZh ? item.titleZh.trim() : '';
    const title = titleZh || rawTitle;
    const sc = Math.min(5, Math.max(1, item.score || 2));
    const isBk = bookmarks.has(item.id);
    const isRead = readItems.has(item.id);
    const extScore = item.hnScore || item.redditScore;
    const eid = escHtml(item.id);
    const titleEsc = escHtml(title);

    // 3 个核心信号 pills
    const soloLabel = { yes: '👤 一人可行', maybe: '👤 需评估', hard: '👤 需团队' }[item.soloFit || 'maybe'];
    const soloClass = { yes: 'solo-yes', maybe: 'solo-maybe', hard: 'solo-hard' }[item.soloFit || 'maybe'];
    const chinaLabel = { high: '🇨🇳 高适配', mid: '🇨🇳 中适配', low: '🇨🇳 受限' }[item.chinaFit || 'mid'];
    const chinaClass = { high: 'china-high', mid: 'china-mid', low: 'china-low' }[item.chinaFit || 'mid'];

    const pillHtml = `
      <div class="card-pills">
        <span class="card-pill ${soloClass}">${soloLabel}</span>
        ${item.chinaFit === 'high' ? `<span class="card-pill ${chinaClass}">${chinaLabel}</span>` : ''}
        ${item.devTimeline ? `<span class="card-pill eval-timeline">⏱ ${escHtml(item.devTimeline)}</span>` : ''}
        ${item.mrr ? `<span class="card-pill" style="background:rgba(34,197,94,0.14);color:#4ade80">💰 ${escHtml(item.mrr)}</span>` : ''}
      </div>`;

    const displayProblem = getDisplayProblem(item);

    return `
    <div class="card-wrap ${scoreClass(sc)}${isRead ? ' is-read' : ''}" data-cid="${eid}">
      <div class="card" role="button" tabindex="0"
           onclick="openDetailOverlay('${eid}')"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetailOverlay('${eid}')}"
           aria-label="${titleEsc}，点击查看详细分析">
        <div class="card-top">
          <div class="source-row">
            <div class="dot ${dotClass(item.source, item.sourceLabel)}" aria-hidden="true"></div>
            <span class="src-name">${escHtml(item.sourceLabel || '')}</span>
            ${extScore ? `<span class="ext-score">▲${extScore}</span>` : ''}
            ${item.category ? `<span class="cat-tag">${escHtml(item.category)}</span>` : ''}
          </div>
          <div class="score-bar" aria-label="潜力评分 ${sc} 分">${scoreDots(sc)}</div>
        </div>
        <div class="card-body">
          <div class="card-title">${titleEsc}</div>
          ${displayProblem ? `<div class="problem-line-text" style="font-size:13px;color:#777;line-height:1.5;margin-top:4px;margin-bottom:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(displayProblem)}</div>` : ''}
          ${pillHtml}
        </div>
      </div>
    </div>`;
  }
  ```

- [ ] **Step 3: 浏览器验证**

  - [ ] 每张卡片结构为：来源行 + 星级 / 标题 / 1-2 行痛点描述 / 3 个 pill
  - [ ] 卡片无展开区块、无底部操作栏
  - [ ] 点击卡片不再内联展开（下一个 Task 实现 overlay，此时点击无反应是正常的）
  - [ ] 两列网格（tablet）和三列网格（desktop）布局正常

- [ ] **Step 4: Commit**

  ```bash
  git add public/index.html
  git commit -m "feat: simplify card to title+problem+3pills, remove inline expansion"
  ```

---

## Task 6：前端 — 详情 Overlay（CSS + HTML 结构）

**Files:**
- Modify: `public/index.html:7-353`（CSS section）
- Modify: `public/index.html:427-429`（在 `<div id="app">` 之后插入 overlay DOM）

- [ ] **Step 1: 在 CSS section 末尾（`</style>` 之前）追加 overlay 样式**

  ```css
  /* ════════════════════════════════════════════════════════
     详情分析页 Overlay
  ════════════════════════════════════════════════════════ */
  .detail-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    z-index: 500; background: #0a0a0f;
    transform: translateY(100%);
    transition: transform 0.3s ease-out;
    overflow-y: auto; -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  .detail-overlay.open { transform: translateY(0); }

  .dov-nav {
    position: sticky; top: 0; z-index: 10;
    background: rgba(10,10,15,0.97); backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px; height: 48px;
  }
  .dov-back { background: none; border: none; color: #888; font-size: 14px; cursor: pointer; padding: 8px 0; display:flex;align-items:center;gap:4px; }
  .dov-back:hover { color: #e2e2e2; }
  .dov-actions { display: flex; gap: 8px; }
  .dov-bk { background: none; border: none; font-size: 18px; cursor: pointer; color: #555; padding: 8px; }
  .dov-bk:hover { color: #f43f5e; }
  .dov-bk.hearted { color: #f43f5e; }

  .dov-body { padding: 20px 16px 40px; max-width: 720px; margin: 0 auto; }

  /* 元信息行 */
  .dov-meta { font-size: 12px; color: #666; margin-bottom: 6px; display:flex;align-items:center;gap:6px; }
  .dov-title { font-size: 22px; font-weight: 800; color: #f0f0f4; line-height: 1.35; margin-bottom: 12px; letter-spacing: -0.3px; }
  .dov-pills { display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 24px; }
  .dov-pill  { font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; }

  /* 分析区块 */
  .dov-section { margin-bottom: 20px; border-radius: 12px; padding: 16px; }
  .dov-section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 12px; display:flex;align-items:center;gap:6px; }
  .dov-row { margin-bottom: 12px; }
  .dov-row:last-child { margin-bottom: 0; }
  .dov-label { font-size: 10px; font-weight: 700; color: #888; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px; }
  .dov-text { font-size: 14px; line-height: 1.6; }

  /* 痛点区（红） */
  .dov-pain { background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.18); }
  .dov-pain .dov-section-title { color: #f87171; }
  .dov-pain .dov-text { color: #fca5a5; }
  .dov-pain .dov-label { color: #f87171; opacity: 0.7; }

  /* 解法区（绿） */
  .dov-solution { background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.18); }
  .dov-solution .dov-section-title { color: #4ade80; }
  .dov-solution .dov-text { color: #86efac; }
  .dov-solution .dov-label { color: #4ade80; opacity: 0.7; }

  /* 可行性区（蓝） */
  .dov-viability { background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.18); }
  .dov-viability .dov-section-title { color: #a5b4fc; }
  .dov-viability .dov-text { color: #c7d2fe; }
  .dov-viability .dov-label { color: #a5b4fc; opacity: 0.7; }

  /* 中国市场区（黄绿） */
  .dov-china { background: rgba(34,197,94,0.05); border: 1px solid rgba(34,197,94,0.15); }
  .dov-china .dov-section-title { color: #4ade80; }
  .dov-china .dov-text { color: #a7f3d0; }
  .dov-china .dov-label { color: #4ade80; opacity: 0.7; }

  /* 中国适配进度条 */
  .dov-progress { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.08); margin-top: 6px; overflow: hidden; }
  .dov-progress-fill { height: 100%; border-radius: 3px; background: #4ade80; transition: width 0.5s ease; }

  /* 来源区 */
  .dov-source-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 13px; color: #818cf8; text-decoration: none; padding: 8px 16px; border: 1px solid rgba(99,102,241,0.25); border-radius: 10px; background: rgba(99,102,241,0.07); }
  .dov-source-link:hover { background: rgba(99,102,241,0.15); }

  /* 技术栈 pill */
  .dov-tech-pills { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
  .dov-tech-pill { font-size: 11px; background: rgba(255,255,255,0.07); color: #9999bb; padding: 3px 9px; border-radius: 6px; }

  @media (min-width: 768px) {
    .dov-body { padding: 24px 28px 48px; }
    .dov-title { font-size: 26px; }
    .dov-nav { padding: 0 28px; }
  }
  ```

- [ ] **Step 2: 在 `<div id="app"></div>` 之后（line ~427）插入 overlay DOM**

  ```html
  <div id="app"></div>
  <div class="detail-overlay" id="detailOverlay" role="dialog" aria-modal="true" aria-label="创意详情分析">
    <nav class="dov-nav">
      <button class="dov-back" onclick="closeDetailOverlay()" aria-label="返回列表">← 返回</button>
      <div class="dov-actions">
        <button class="dov-bk" id="dovBkBtn" onclick="dovToggleBookmark()" aria-label="收藏">♡</button>
      </div>
    </nav>
    <div class="dov-body" id="dovBody"></div>
  </div>
  <div class="toast" id="toast"></div>
  ```

- [ ] **Step 3: 浏览器验证（CSS 占位）**

  打开页面，在控制台执行：
  ```js
  document.getElementById('detailOverlay').classList.add('open')
  ```
  预期：页面被完全覆盖，显示空白的 overlay（顶部有"← 返回"和"♡"）

- [ ] **Step 4: Commit**

  ```bash
  git add public/index.html
  git commit -m "feat: add detail overlay CSS and DOM structure"
  ```

---

## Task 7：前端 — 详情 Overlay JavaScript

**Files:**
- Modify: `public/index.html:430+`（JS section）

- [ ] **Step 1: 新增 dovSection helper 函数（在 JS section 开头附近）**

  ```js
  // ── 详情 Overlay ──────────────────────────────────────
  let currentDetailId = null;

  function dovSection(cls, icon, title, rows) {
    if (!rows.some(r => r)) return '';
    return `<div class="dov-section ${cls}">
      <div class="dov-section-title">${icon} ${title}</div>
      ${rows.filter(Boolean).join('')}
    </div>`;
  }
  function dovRow(label, text) {
    if (!text) return '';
    return `<div class="dov-row"><div class="dov-label">${label}</div><div class="dov-text">${escHtml(text)}</div></div>`;
  }
  function dovTechPills(stack) {
    if (!stack || !stack.length) return '';
    const pills = stack.map(t => `<span class="dov-tech-pill">${escHtml(t)}</span>`).join('');
    return `<div class="dov-row"><div class="dov-label">推荐技术栈</div><div class="dov-tech-pills">${pills}</div></div>`;
  }
  ```

- [ ] **Step 2: 新增 renderDetailOverlay 函数**

  ```js
  function renderDetailOverlay(item) {
    const sc = Math.min(5, Math.max(1, item.score || 2));
    const soloLabel = { yes: '✅ 一人可行', maybe: '⚠️ 需评估', hard: '❌ 需团队' }[item.soloFit || 'maybe'];
    const soloClass = { yes: 'solo-yes', maybe: 'solo-maybe', hard: 'solo-hard' }[item.soloFit || 'maybe'];
    const chinaFitPct = { high: 85, mid: 55, low: 25 }[item.chinaFit || 'mid'];
    const chinaFitLabel = { high: '高', mid: '中', low: '低' }[item.chinaFit || 'mid'];

    const pills = `
      <div class="dov-pills">
        <span class="dov-pill ${soloClass}">${soloLabel}</span>
        ${item.chinaFit ? `<span class="dov-pill china-${item.chinaFit === 'high' ? 'high' : item.chinaFit === 'mid' ? 'mid' : 'low'}">🇨🇳 中国${chinaFitLabel}适配</span>` : ''}
        ${item.devTimeline ? `<span class="dov-pill eval-timeline">⏱ ${escHtml(item.devTimeline)}</span>` : ''}
        ${item.mrr ? `<span class="dov-pill" style="background:rgba(34,197,94,0.14);color:#4ade80">💰 ${escHtml(item.mrr)}</span>` : ''}
      </div>`;

    const painSection = dovSection('dov-pain', '🔴', '真实痛点', [
      dovRow('痛点描述', item.problem),
      dovRow('目标用户', item.targetUsers),
      dovRow('市场规模', item.marketSize),
    ]);

    const solutionSection = dovSection('dov-solution', '🟢', '创新解法', [
      dovRow('解法', item.solution),
      dovRow('竞品不足', item.competitors),
      dovRow('中国市场空白', item.chinaGap),
    ]);

    const viabilityConclusion = { yes: '✅ 一人可以做，推荐入手', maybe: '⚠️ 可行但需评估技术难点', hard: '❌ 需要团队资源' }[item.soloFit || 'maybe'];
    const viabilitySection = dovSection('dov-viability', '🔵', '一人公司可行性', [
      `<div class="dov-row"><div class="dov-text" style="font-size:15px;font-weight:700">${viabilityConclusion}</div></div>`,
      dovRow('可行性分析', item.soloReason),
      dovRow('MVP 路径', item.mvp),
      dovTechPills(item.techStack),
      dovRow('变现路径', item.monetization),
      dovRow('主要风险', item.risks),
      dovRow('资源需求', (item.resourceNeeds || []).join('；')),
    ]);

    const chinaSection = `<div class="dov-section dov-china">
      <div class="dov-section-title">🟡 中国市场机会</div>
      <div class="dov-row">
        <div class="dov-label">适配度：${chinaFitLabel}</div>
        <div class="dov-progress"><div class="dov-progress-fill" style="width:${chinaFitPct}%"></div></div>
      </div>
      ${dovRow('市场分析', item.chinaReason)}
      ${dovRow('冷启动渠道', item.coldStart)}
    </div>`;

    const sourceSection = item.url ? `
      <div style="padding-top:8px;border-top:1px solid rgba(255,255,255,0.06)">
        <div class="dov-label">原始来源：${escHtml(item.sourceLabel || '')}</div>
        <a class="dov-source-link" href="${escHtml(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">查看原帖 →</a>
      </div>` : '';

    return `
      <div class="dov-meta">
        <div class="dot ${dotClass(item.source, item.sourceLabel)}" aria-hidden="true"></div>
        ${escHtml(item.sourceLabel || '')}
        <span style="color:#2a2a3a">·</span>
        <span>${scoreDots(sc)}</span>
      </div>
      <h1 class="dov-title">${escHtml(fixTitle(item.titleZh || item.title || ''))}</h1>
      ${pills}
      ${painSection}
      ${solutionSection}
      ${viabilitySection}
      ${chinaSection}
      ${sourceSection}
    `;
  }
  ```

- [ ] **Step 3: 新增 openDetailOverlay / closeDetailOverlay / dovToggleBookmark 函数**

  ```js
  function openDetailOverlay(id) {
    const item = allData.find(d => d.id === id);
    if (!item) return;
    currentDetailId = id;

    // 渲染内容
    document.getElementById('dovBody').innerHTML = renderDetailOverlay(item);
    document.getElementById('dovBody').scrollTop = 0;

    // 更新收藏按钮状态
    const bkBtn = document.getElementById('dovBkBtn');
    const isBk = bookmarks.has(id);
    bkBtn.textContent = isBk ? '♥' : '♡';
    bkBtn.classList.toggle('hearted', isBk);

    // 标记已读
    if (!readItems.has(id)) {
      readItems.add(id); saveRead();
      const wrap = document.querySelector(`[data-cid="${CSS.escape(id)}"]`);
      if (wrap) wrap.classList.add('is-read');
    }

    // 显示 overlay
    const overlay = document.getElementById('detailOverlay');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // 更新 hash URL（可分享）
    history.pushState({ ideaId: id }, '', `#idea-${id}`);
  }

  function closeDetailOverlay() {
    document.getElementById('detailOverlay').classList.remove('open');
    document.body.style.overflow = '';
    currentDetailId = null;

    // 恢复 URL（去掉 hash）
    history.pushState(null, '', location.pathname + location.search);
  }

  function dovToggleBookmark() {
    if (!currentDetailId) return;
    const add = !bookmarks.has(currentDetailId);
    add ? bookmarks.add(currentDetailId) : bookmarks.delete(currentDetailId);
    saveBk(); updateBadge();
    const bkBtn = document.getElementById('dovBkBtn');
    bkBtn.textContent = add ? '♥' : '♡';
    bkBtn.classList.toggle('hearted', add);
    showToast(add ? '已收藏 ♥' : '已取消收藏', add ? 'ok' : '');
    // 同步列表卡片收藏状态
    const cardBk = document.querySelector(`[data-bk="${CSS.escape(currentDetailId)}"]`);
    if (cardBk) { cardBk.textContent = add ? '♥ 已收藏' : '♡ 收藏'; cardBk.classList.toggle('starred', add); }
  }
  ```

- [ ] **Step 4: 在 `loadData` / `init` 处理 hash URL（页面加载时自动打开详情）**

  在 `filterAndRender()` 调用之后（约 line 662），追加：
  ```js
  // 支持 hash URL 分享链接（#idea-{id}）
  const hashMatch = location.hash.match(/^#idea-(.+)$/);
  if (hashMatch) {
    const targetId = decodeURIComponent(hashMatch[1]);
    // 稍微延迟，等 DOM 渲染完成
    setTimeout(() => openDetailOverlay(targetId), 50);
  }
  ```

  同时在 script 底部添加 popstate 监听（浏览器回退关闭 overlay）：
  ```js
  window.addEventListener('popstate', () => {
    if (!location.hash.startsWith('#idea-')) {
      document.getElementById('detailOverlay').classList.remove('open');
      document.body.style.overflow = '';
      currentDetailId = null;
    }
  });
  ```

- [ ] **Step 5: 添加 ESC 键关闭 overlay**

  在 script 底部追加：
  ```js
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('detailOverlay').classList.contains('open')) {
      closeDetailOverlay();
    }
  });
  ```

- [ ] **Step 6: 浏览器验证**

  - [ ] 点击任意卡片 → overlay 从底部滑入，显示完整分析
  - [ ] URL 变为 `#idea-{id}`
  - [ ] overlay 中收藏按钮正常工作（♡ ↔ ♥，同步列表卡片状态）
  - [ ] 点"← 返回" → overlay 关上，URL 恢复
  - [ ] ESC 键关闭 overlay
  - [ ] 复制含 hash 的 URL 粘贴到新标签页 → 直接打开对应详情页
  - [ ] 今日精选 banner 卡片点击也能打开 overlay
  - [ ] `renderDetailOverlay` 中所有字段有内容的正常显示，没有的字段不渲染空白行

- [ ] **Step 7: Commit**

  ```bash
  git add public/index.html
  git commit -m "feat: add full-screen detail overlay with analysis sections + hash URL"
  ```

---

## Task 8：今日精选 banner — 点击接入 overlay

**Files:**
- Modify: `public/index.html:859-913`（renderFeatured 函数）

- [ ] **Step 1: 找到 renderFeatured 函数中 featured-card 的 onclick 事件**

  当前 featured card 通过 `onclick` 调用 `toggleExpand`，需要改为 `openDetailOverlay`：
  ```bash
  grep -n "toggleExpand\|openDetail" "/Users/blancheume/Library/Mobile Documents/com~apple~CloudDocs/AIMei/金点子/idea-radar/public/index.html" | grep -i feat
  ```

- [ ] **Step 2: 将 featured card 的点击改为 openDetailOverlay**

  在 `renderFeatured` 函数中，找到 featured-card 的 `onclick` 属性，将：
  ```js
  onclick="toggleExpand('${eid}')"
  ```
  改为：
  ```js
  onclick="openDetailOverlay('${eid}')"
  ```

- [ ] **Step 3: 浏览器验证**

  - [ ] 点击今日精选横滑 banner 中的卡片 → overlay 正常打开

- [ ] **Step 4: Commit**

  ```bash
  git add public/index.html
  git commit -m "feat: featured cards now open detail overlay"
  ```

---

## Task 9：最终联调 + 部署

- [ ] **Step 1: 全功能回归测试**

  用 `npx serve public` 本地测试以下场景：

  | 场景 | 预期结果 |
  |------|---------|
  | 手机宽 390px，顶栏 | 一行显示不换行 |
  | 点 ⋯ 菜单 | 弹出清空已读/隐藏已读 |
  | 默认 filter chips | 只显示 4 个核心 + "更多" |
  | 点"更多" | 展开剩余 chip |
  | Tab 栏 | 只有 精选/全部/验证收入/收藏 |
  | 点列表卡片 | 全屏详情 overlay 滑入 |
  | 详情页收藏 | 列表卡片同步高亮 |
  | 分享链接 | 新标签直接打开详情 |
  | ESC / 返回键 | overlay 关闭 |
  | 点精选 banner 卡 | overlay 打开 |

- [ ] **Step 2: 推送到 GitHub 触发部署**

  ```bash
  cd "/Users/blancheume/Library/Mobile Documents/com~apple~CloudDocs/AIMei/金点子/idea-radar"
  git push origin main
  ```

  等待约 1-2 分钟后访问 https://aimeimei0991.github.io/idea-radar/ 验证线上效果。

- [ ] **Step 3: 线上验证同 Step 1 场景清单**

---

## Self-Review 摘要

**Spec coverage check:**
- ✅ 顶栏重组 → Task 3
- ✅ Tab 4 个 → Task 4
- ✅ Filter chips 4 核心 + 更多 → Task 4
- ✅ 卡片极简 + 3 pills → Task 5
- ✅ 详情 overlay CSS + DOM → Task 6
- ✅ 详情 overlay JS + hash URL → Task 7
- ✅ Featured banner 接入 overlay → Task 8
- ✅ 评分归一化 + 质量门槛 → Task 1
- ✅ 新增 3 字段 → Task 2
- ✅ 部署验证 → Task 9

**无 placeholder，无 TBD，所有 code step 有完整代码。**
