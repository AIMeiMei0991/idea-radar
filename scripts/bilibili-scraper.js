// B站/抖音数据模块 — mock 数据，聚焦视频创作者痛点
// 受众：UP主、短视频创作者、MCN从业者、用视频获客的品牌主理人

// ─── 评分 ─────────────────────────────────────────────────────────────────

function scoreBiliItem(title, desc) {
  let score = 3;
  const text = (title + ' ' + desc).toLowerCase();
  if (text.includes('变现') || text.includes('收入') || text.includes('恰饭') || text.includes('赚钱')) score += 1;
  if (text.includes('ai') || text.includes('自动') || text.includes('批量')) score += 1;
  if (text.includes('up主') || text.includes('创作者') || text.includes('博主') || text.includes('运营')) score += 1;
  if (text.includes('数据') || text.includes('分析') || text.includes('选题')) score += 1;
  score = Math.max(1, Math.min(5, score));
  const reasons = ['视频工具', '创作者变现', 'AI内容', '短视频运营', '数据分析'];
  const idx = Math.abs(title.charCodeAt(0) + title.length) % reasons.length;
  return { score, reason: reasons[idx] };
}

// ─── 分析 ─────────────────────────────────────────────────────────────────

function analyzeBiliItem(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();

  let problem = '视频创作者缺乏高效的内容生产和运营工具，大量时间消耗在重复操作上';
  let chinaFit = 'high', chinaReason = '国内短视频市场规模全球最大，创作者工具供给严重不足';
  let soloFit = 'yes', soloReason = '调用 API + 前端，核心功能一人4周可完成';

  if (text.includes('选题') || text.includes('爆款') || text.includes('热点')) {
    problem = 'UP主靠经验选题，爆款率低，缺乏数据驱动的选题决策工具';
    chinaReason = '抖音/B站平台数据公开，选题分析工具几乎空白';
    soloReason = '抓取公开数据 + AI 分析，前端展示，一人可做';
  } else if (text.includes('剪辑') || text.includes('字幕') || text.includes('配音')) {
    problem = '视频剪辑/字幕/配音耗时，创作者花 70% 时间在后期而非创意';
    chinaReason = '剪映覆盖通用场景，垂直品类（带货/教程/Vlog）有专业化工具空间';
    soloReason = '调用 Whisper/TTS API，核心是交互设计而非底层技术';
  } else if (text.includes('数据') || text.includes('分析') || text.includes('粉丝')) {
    problem = '创作者看不懂后台数据，不知道哪类内容真正带来粉丝和收入';
    chinaReason = 'B站/抖音官方数据工具弱，第三方数据平台价格贵且针对MCN';
    soloReason = '轻量 SaaS，数据可视化 + 简单 AI 解读，一人可跑通';
  } else if (text.includes('变现') || text.includes('带货') || text.includes('接单')) {
    problem = '中小UP主不知道如何系统变现，错过匹配的商单和带货机会';
    chinaReason = '万粉以下创作者有数百万，平台没有服务这个群体的变现工具';
    soloFit = 'maybe'; soloReason = '需对接多个平台 API，核心功能一人可做，完整产品需3个月';
  } else if (text.includes('脚本') || text.includes('文案') || text.includes('标题')) {
    problem = '写脚本/标题/封面文案耗时，创作者不擅长也不愿意花时间在文字上';
    chinaReason = '国内 AI 写作工具偏向图文，短视频脚本场景几乎没有专门产品';
    soloReason = '调用 Qwen/GPT + 领域 prompt 工程，核心功能2周可出 demo';
  } else if (text.includes('直播') || text.includes('互动')) {
    problem = '直播运营全靠人工盯场，评论互动/礼物答谢/数据记录全是体力活';
    chinaReason = '国内直播规模全球第一，直播辅助工具仍是蓝海';
    soloFit = 'maybe'; soloReason = '需接入平台直播 API，对资质有要求，核心逻辑一人可完成';
  }

  return {
    problem, chinaFit, chinaReason, soloFit, soloReason,
    targetUsers: 'UP主、短视频创作者、MCN运营、用视频获客的品牌主理人',
    competitors: '剪映（通用不专业）、新榜/飞瓜（贵且面向MCN）；中小创作者工具市场空白',
    chinaGap: '国内有3000万+活跃创作者，平台工具服务头部，中腰部创作者严重缺乏专业工具',
    mvp: '单一痛点工具（选题/字幕/数据），4周上线，前50名免费换口碑',
    coldStart: '在B站"创作者交流"分区投稿亲测视频，即刻@独立开发者话题',
  };
}

function detectBiliCategory(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  if (text.includes('ai') || text.includes('自动') || text.includes('批量')) return 'AI工具';
  if (text.includes('数据') || text.includes('分析') || text.includes('选题')) return '数据分析';
  if (text.includes('剪辑') || text.includes('字幕') || text.includes('配音')) return '视频创作';
  if (text.includes('变现') || text.includes('带货') || text.includes('商单')) return '创业者工具';
  if (text.includes('脚本') || text.includes('文案') || text.includes('标题')) return '内容创作';
  if (text.includes('直播') || text.includes('互动')) return '效率工具';
  return '视频创作';
}

// ─── mock 数据 ────────────────────────────────────────────────────────────
// 模拟 B站/抖音 上真实存在的"创作者痛点"相关内容

const MOCK_VIDEOS = [
  // B站痛点
  { id: '001', title: '我用AI工具把剪辑时间从8小时压缩到1小时，UP主必看', source: 'bilibili', desc: 'AI剪辑工具效率实测' },
  { id: '002', title: '抖音选题数据化：我是怎么把爆款率从5%提升到30%的', source: 'bilibili', desc: '爆款选题方法论' },
  { id: '003', title: 'UP主接商单被坑全过程：缺一个靠谱的对接工具', source: 'bilibili', desc: '商单接单痛点' },
  { id: '004', title: '我的B站数据分析工具：帮你看懂哪类视频真正涨粉', source: 'bilibili', desc: '创作者数据分析' },
  { id: '005', title: '万粉以下UP主如何系统变现？我整理了12种方式', source: 'bilibili', desc: '中小创作者变现方法' },
  // 抖音痛点
  { id: '006', title: '抖音AI文案工具测评：哪个最适合中国短视频场景', source: 'douyin', desc: 'AI文案工具横评' },
  { id: '007', title: '用这个脚本生成工具，我一天能出20条短视频脚本', source: 'douyin', desc: '批量脚本生产工具' },
  { id: '008', title: '短视频博主的字幕噩梦：为什么还没有一个好用的自动字幕工具', source: 'douyin', desc: '字幕工具痛点' },
  { id: '009', title: '直播复盘太耗时：我需要一个自动生成直播数据报告的工具', source: 'douyin', desc: '直播数据分析需求' },
  { id: '010', title: '抖音带货选品数据分析：我在用的工具和方法论', source: 'douyin', desc: '带货选品工具' },
  // 进阶/交叉
  { id: '011', title: '一人MCN是否可行？我用AI工具替代了3个运营岗位', source: 'bilibili', desc: '一人MCN运营实践' },
  { id: '012', title: '短视频封面批量生成工具：Canva+AI的工作流拆解', source: 'douyin', desc: '封面设计自动化' },
  { id: '013', title: '跨平台内容分发有多痛：B站/抖音/视频号三端同步工具需求', source: 'bilibili', desc: '多平台内容同步痛点' },
  { id: '014', title: '粉丝画像分析工具测评：帮你搞清楚你的观众是谁', source: 'bilibili', desc: '粉丝数据分析' },
  { id: '015', title: '抖音私信自动回复工具：我用它节省了每天2小时', source: 'douyin', desc: '私信自动化工具' },
];

// ─── 主函数 ───────────────────────────────────────────────────────────────

async function fetchBilibiliData() {
  console.log('[B站/抖音] 使用 mock 数据（平台反爬，实时 API 需授权）...');

  const today = new Date().toISOString().slice(0, 10);
  const results = [];

  for (const video of MOCK_VIDEOS) {
    const { score, reason } = scoreBiliItem(video.title, video.desc);
    const analysis = analyzeBiliItem(video.title, video.desc);
    const category = detectBiliCategory(video.title, video.desc);

    results.push({
      id: `${video.source}-${video.id}`,
      title: video.title.slice(0, 100),
      score, scoreReason: reason,
      ...analysis,
      desc: video.desc,
      url: video.source === 'bilibili'
        ? `https://search.bilibili.com/all?keyword=${encodeURIComponent(video.title.slice(0, 20))}`
        : `https://www.douyin.com/search/${encodeURIComponent(video.title.slice(0, 20))}`,
      source: video.source,
      sourceLabel: video.source === 'bilibili' ? 'B站(样本)' : '抖音(样本)',
      category,
      fetchedAt: new Date().toISOString(),
      dateKey: today,
    });
  }

  console.log(`[B站/抖音] 输出 ${results.length} 条 (mock)`);
  return results;
}

module.exports = { fetchBilibiliData };
