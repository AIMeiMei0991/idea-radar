// 36氪 / 少数派数据抓取模块
// 聚焦：创投热点 + 传统行业数字化痛点 + 国产替代方向

// ─── 分析函数 ──────────────────────────────────────────────────────────────
function score36krItem(title, desc) {
  let score = 3;
  const text = (title + ' ' + desc).toLowerCase();
  if (text.includes('一人') || text.includes('独立开发') || text.includes('副业')) { score += 1; }
  if (text.includes('传统') || text.includes('数字化') || text.includes('信息化')) { score += 1; }
  if (text.includes('ai') || text.includes('人工智能') || text.includes('大模型')) { score += 1; }
  if (text.includes('中小') || text.includes('小微') || text.includes('个体')) { score += 1; }
  score = Math.max(1, Math.min(5, score));
  const reasons = ['AI工具', '数字化刚需', '中小企业市场', '一人可行'];
  return { score, reason: reasons[Math.floor(Math.random() * reasons.length)] };
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
  } else if (text.includes('saas') || text.includes('工具')) {
    problem = '中小企业依赖 Excel 和微信，缺乏适合国情的轻量 SaaS 工具';
    chinaFit = 'high'; chinaReason = '国内 SaaS 渗透率仅 7%，远低于美国 70%+';
    soloFit = 'yes'; soloReason = '垂直行业 SaaS 功能集中，一人可做到 MVP';
  } else if (text.includes('供应链') || text.includes('物流') || text.includes('仓储')) {
    problem = '供应链环节纸质单据多，跨系统对账耗时，中小工厂数字化落后';
    chinaFit = 'high'; chinaReason = '中国有 600 万中小制造企业，供应链数字化率极低';
    soloFit = 'maybe'; soloReason = '需要对接工厂系统，集成复杂度高，但 MVP 可做单点';
  }

  return { problem, chinaFit, chinaReason, soloFit, soloReason,
    targetUsers: '中小企业主、传统行业创业者、数字化转型负责人',
    competitors: '企业级 ERP（太重）；Excel+微信（效率低）；国内现有 SaaS 功能不够垂直',
    chinaGap: '国内中小企业数字化率不足 30%，本土化轻量工具严重缺位',
    mvp: '聚焦最高频 1 个场景，微信小程序 + 云端存储，4 周内上线验证',
    coldStart: '在行业协会/企业微信群冷启动，前 50 家免费换口碑和反馈'
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
  return '数字工具';
}

// ─── 36氪模拟数据 ─────────────────────────────────────────────────────────
async function fetch36krData() {
  console.log('[36氪] 开始抓取数据...');

  const articles = [
    { id: '36kr-001', title: '传统餐饮门店还在用手写记账，数字化收银只需一台平板', views: 28000, topic: '餐饮数字化' },
    { id: '36kr-002', title: '中小企业微信私域运营还靠手动群发？AI自动回复工具来了', views: 35000, topic: '私域运营' },
    { id: '36kr-003', title: '独立开发者月入5万的秘密：只做一件事，做到极致', views: 62000, topic: '独立开发' },
    { id: '36kr-004', title: '国内中小制造企业供应链管理还停留在Excel表格时代', views: 22000, topic: '供应链管理' },
    { id: '36kr-005', title: '三四线城市连锁门店管理难题：总部如何实时监控各门店数据', views: 19000, topic: '连锁管理' },
    { id: '36kr-006', title: '传统建材行业报价还靠打电话？一人开发的SaaS工具解决了', views: 31000, topic: '建材行业' },
    { id: '36kr-007', title: 'AI大模型落地中小企业：不是聊天机器人，而是自动化流程', views: 45000, topic: 'AI落地' },
    { id: '36kr-008', title: '个体工商户财税合规最怕什么？记账开票报税全流程痛点调查', views: 38000, topic: '个体户财税' },
    { id: '36kr-009', title: '美发店还在用手写预约本？这个痛点孕育了一个百万用户产品', views: 27000, topic: '本地服务预约' },
    { id: '36kr-010', title: '一人公司创业实录：用AI工具把运营成本压到极致', views: 71000, topic: '一人公司' },
    { id: '36kr-011', title: '传统物流行业司机端APP体验差：路线规划全靠嘴问', views: 18000, topic: '物流数字化' },
    { id: '36kr-012', title: '国产替代浪潮下，企业协同办公工具赛道还有机会吗', views: 29000, topic: '企业协同' },
    { id: '36kr-013', title: '中小学外教机构课程管理混乱，排课排到头大', views: 16000, topic: '教育机构管理' },
    { id: '36kr-014', title: '人力资源外包公司的痛：员工档案管理全靠Excel堆', views: 24000, topic: 'HR数字化' },
    { id: '36kr-015', title: '社区团购平台衰退后，实体菜市场数字化迎来第二春', views: 33000, topic: '生鲜零售' },
  ];

  const results = [];
  for (const art of articles) {
    const { score, reason } = score36krItem(art.title, art.topic);
    const analysis = analyze36krItem(art.title, art.topic);
    const category = detect36krCategory(art.title);
    const dateKey = new Date(Date.now() - Math.floor(Math.random() * 3) * 86400000).toISOString().slice(0, 10);

    results.push({
      id: art.id,
      title: art.title.slice(0, 100),
      score, scoreReason: reason,
      ...analysis,
      desc: `36氪报道，${art.views.toLocaleString()} 阅读，聚焦"${art.topic}"方向的传统行业痛点`,
      url: `https://36kr.com/p/${art.id.replace('36kr-', '')}`,
      source: '36kr',
      sourceLabel: '36氪',
      category,
      fetchedAt: new Date().toISOString(),
      dateKey,
      views: art.views,
    });
  }

  console.log(`[36氪] 模拟 ${results.length} 条创投热点`);
  return results;
}

module.exports = { fetch36krData };
