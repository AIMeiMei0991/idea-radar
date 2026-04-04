// 每日抓取脚本 - 运行于 GitHub Actions
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../public/data/ideas.json');

// 导入中文数据源模块
const { fetchZhihuData } = require('./zhihu-scraper');
const { fetchXhsData } = require('./xhs-scraper');

// ─── 标题修正 ──────────────────────────────────────────────────────────────
function fixTitle(t) {
  return t
    .replace(/\bAi\b/g,'AI').replace(/\bSaas\b/g,'SaaS').replace(/\bMrr\b/g,'MRR')
    .replace(/\bArr\b/g,'ARR').replace(/\bSeo\b/g,'SEO').replace(/\bApi\b/g,'API')
    .replace(/\bCrm\b/g,'CRM').replace(/\bUgc\b/g,'UGC').replace(/\bB2b\b/g,'B2B')
    .replace(/\bB2c\b/g,'B2C').replace(/\bUi\b/g,'UI').replace(/\bUx\b/g,'UX')
    .replace(/\bIo\b/g,'IO').replace(/\bPdf\b/g,'PDF').replace(/\bCsv\b/g,'CSV');
}

// ─── 分类检测 ──────────────────────────────────────────────────────────────
const CATEGORIES = {
  'ai': 'AI工具', 'video': '视频创作', 'marketing': '营销增长',
  'saas': 'SaaS工具', 'content': '内容创作', 'analytics': '数据分析',
  'ecommerce': '电商工具', 'productivity': '效率工具', 'education': '教育学习',
  'health': '健康生活', 'finance': '财务工具', 'developer': '开发者工具',
  'design': '设计工具', 'hr': 'HR工具', 'crm': '客户管理',
};

function detectCategory(text) {
  const t = text.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORIES)) {
    if (t.includes(k)) return v;
  }
  return '数字工具';
}

// ─── 评分 ──────────────────────────────────────────────────────────────────
const HIGH_KEYWORDS = ['ai','automation','saas','creator','marketing','analytics','video','schedule','content','agent','tool'];
const LOW_KEYWORDS  = ['game','dating','nft','crypto','gambling','blockchain'];
const CHINA_KEYWORDS = ['creator','video','content','social','marketing','ecommerce','schedule','seo','analytics','email'];

function scoreItem(title, desc, mrr, baseScore = 2) {
  const text = (title + ' ' + (desc || '')).toLowerCase();
  let score = baseScore;
  const reasons = [];
  if (mrr) { score += 2; reasons.push(`已验证收入 ${mrr}`); }
  if (HIGH_KEYWORDS.some(k => text.includes(k))) { score += 1; reasons.push('热门赛道'); }
  if (LOW_KEYWORDS.some(k => text.includes(k)))  { score -= 2; reasons.push('中国受限'); }
  if (CHINA_KEYWORDS.filter(k => text.includes(k)).length >= 2) { score += 1; reasons.push('适配中国市场'); }
  return { score: Math.max(1, Math.min(5, score)), reason: reasons.join(' · ') || '基础工具' };
}

// ─── 核心分析：金点子三维评估 ─────────────────────────────────────────────
// 返回 { problem, chinaFit, chinaReason, soloFit, soloReason }
function analyzeProduct(title, desc, mrr) {
  const text = (title + ' ' + (desc || '')).toLowerCase();
  const t = title; // 保留原始大小写，用于兜底展示

  // ── 1. 核心问题：按精确度从高到低匹配 ─────────────────────────────────
  let problem;
  // —— 内容 & 写作 ——
  if (text.includes('humaniz'))
    problem = 'AI 写的文字一眼就被检测出来，用此工具改写为人类风格绕过检测';
  else if (text.includes('paraphras') || text.includes('rewrite'))
    problem = '一键改写/降重，让 AI 生成内容通过查重和 AI 检测';
  else if (text.includes('transcri') && (text.includes('audio') || text.includes('video') || text.includes('podcast') || text.includes('meeting')))
    problem = '音视频/会议自动转文字，省去人工逐字听写的时间';
  else if (text.includes('subtitle') || text.includes('caption'))
    problem = '视频字幕自动生成，多语言版本一键导出';
  else if (text.includes('voic') && (text.includes('clone') || text.includes('synth') || text.includes('over')))
    problem = 'AI 克隆声音或合成配音，内容创作者无需专业录音棚';
  else if (text.includes('text to speech') || text.includes('tts'))
    problem = '文字转语音，批量生成有声内容';
  else if ((text.includes('ai') || text.includes('auto')) && text.includes('translat'))
    problem = 'AI 翻译工具，降低内容出海/多语言运营成本';
  else if (text.includes('ai') && text.includes('video'))
    problem = '创作者批量生成视频，解决内容产量低的效率瓶颈';
  else if (text.includes('video') && (text.includes('edit') || text.includes('clip') || text.includes('short')))
    problem = '长视频自动剪辑成短视频，一条内容变多条';
  else if (text.includes('ai') && text.includes('seo'))
    problem = 'AI 批量生成 SEO 文章，解决内容获客成本高的问题';
  else if (text.includes('ai') && (text.includes('write') || text.includes('copywrite') || text.includes('copy')))
    problem = 'AI 代写营销文案，降低内容创作成本';
  else if (text.includes('ai') && text.includes('blog'))
    problem = 'AI 生成博客/文章，支撑内容营销不缺货';
  else if (text.includes('newsletter'))
    problem = '邮件 Newsletter 自动化发布，创作者建立私域流量';
  // —— 销售 & 邮件 ——
  else if (text.includes('cold email') || (text.includes('email') && text.includes('outreach')))
    problem = '冷邮件自动化外联，B2B 销售每天触达数百潜在客户';
  else if (text.includes('lead') && (text.includes('gen') || text.includes('find') || text.includes('scrap')))
    problem = '自动挖掘精准销售线索，减少手动找客户的时间';
  else if (text.includes('ai') && text.includes('email'))
    problem = 'AI 起草个性化邮件，销售效率提升数倍';
  else if (text.includes('email') && (text.includes('campaign') || text.includes('marketing') || text.includes('automat')))
    problem = '邮件营销自动化，用精准触达提升付费转化';
  else if (text.includes('email'))
    problem = '邮件工具，自动化沟通流程减少重复操作';
  // —— 社交媒体 & 运营 ——
  else if (text.includes('schedule') && (text.includes('post') || text.includes('social') || text.includes('content')))
    problem = '多平台内容自动排期发布，运营从重复劳动中解放';
  else if (text.includes('social media') && text.includes('manag'))
    problem = '社交媒体多账号统一管理，团队协作效率翻倍';
  else if (text.includes('influencer'))
    problem = 'KOL/网红营销管理平台，帮品牌找到匹配的创作者合作';
  else if (text.includes('ugc') || (text.includes('user') && text.includes('generat')))
    problem = '用户生成内容（UGC）自动收集整理，做社交证明降低获客成本';
  // —— 电商 ——
  else if (text.includes('shopify') || text.includes('woocommerce'))
    problem = 'Shopify/电商店铺运营提效工具，降低卖家日常操作成本';
  else if (text.includes('amazon') || text.includes('fba'))
    problem = '亚马逊/跨境电商运营提效，降低选品和投流决策成本';
  else if (text.includes('dropshipping') || text.includes('print on demand'))
    problem = '无货源电商一件代发，零库存启动在线销售';
  else if (text.includes('ecommerce') || text.includes('e-commerce'))
    problem = '电商运营自动化，降低 GMV 提升的人力成本';
  // —— 开发者工具 ——
  else if (text.includes('nocode') || text.includes('no-code') || text.includes('no code') || text.includes('lowcode'))
    problem = '无代码/低代码建站，非技术人员也能独立上线产品';
  else if (text.includes('deploy') || text.includes('hosting') || text.includes('serverless'))
    problem = '应用部署/托管自动化，开发者一条命令上线省去运维';
  else if (text.includes('monitor') && (text.includes('uptime') || text.includes('server') || text.includes('website')))
    problem = '网站/服务器宕机实时报警，故障第一时间被发现';
  else if (text.includes('api') && (text.includes('gateway') || text.includes('manag') || text.includes('mock')))
    problem = 'API 管理/测试工具，减少前后端联调的沟通成本';
  else if (text.includes('git') || text.includes('code review') || text.includes('pull request'))
    problem = '代码审查自动化，AI 发现低级错误减轻 Code Review 负担';
  else if (text.includes('developer') || text.includes('devops') || text.includes('ci/cd'))
    problem = '开发基础设施工具，减少工程师重复搭建和维护的时间';
  // —— AI 助手类 ——
  else if (text.includes('ai') && (text.includes('chatbot') || text.includes('chat bot') || text.includes('assistant')))
    problem = 'AI 智能问答助手，自动处理客户高频咨询问题';
  else if (text.includes('ai') && text.includes('customer') && (text.includes('support') || text.includes('service')))
    problem = 'AI 客服代替人工处理重复工单，7×24 小时响应';
  else if (text.includes('ai') && (text.includes('resume') || text.includes('cv') || text.includes('job')))
    problem = 'AI 优化简历，提升投递通过率和面试邀请率';
  else if (text.includes('ai') && (text.includes('legal') || text.includes('contract') || text.includes('law')))
    problem = 'AI 审阅合同条款，中小企业省去动辄数千的律师费';
  else if (text.includes('ai') && text.includes('coach'))
    problem = 'AI 私人教练/顾问，低成本获得专业级指导';
  else if (text.includes('ai') && (text.includes('data') || text.includes('insight') || text.includes('report')))
    problem = 'AI 自动分析数据并生成报告，省去分析师数小时的手工整理';
  else if (text.includes('ai') && (text.includes('image') || text.includes('photo') || text.includes('design')))
    problem = 'AI 生成/编辑图像，非设计师也能产出专业视觉内容';
  else if (text.includes('ai') && text.includes('agent'))
    problem = 'AI Agent 自动执行多步骤任务，释放人力做高价值工作';
  else if (text.includes('ai') && text.includes('automat'))
    problem = 'AI 驱动工作流自动化，减少重复操作节省大量时间';
  else if (text.includes('ai') && text.includes('search'))
    problem = 'AI 驱动的智能搜索，让用户快速找到真正有用的信息';
  else if (text.includes('ai') && text.includes('summar'))
    problem = 'AI 一键总结长文档/视频，快速提取核心信息';
  else if (text.includes('ai') && text.includes('interview'))
    problem = 'AI 模拟面试，求职者提前练习提升真实面试通过率';
  // —— 效率 & 协作 ——
  else if (text.includes('schedule') || text.includes('booking') || text.includes('appointment'))
    problem = '在线预约排班工具，减少来回沟通确认时间';
  else if (text.includes('invoice') || text.includes('billing') || text.includes('payment'))
    problem = '自动开票和收款管理，自由职业者/小企业省时 80%';
  else if (text.includes('accounting') || text.includes('bookkeep') || text.includes('finance'))
    problem = '自动化记账报税，降低财务合规成本';
  else if (text.includes('analytics') || text.includes('attribution') || text.includes('tracking'))
    problem = '数据追踪与归因，让每一分广告预算花得清楚';
  else if (text.includes('crm') || (text.includes('customer') && text.includes('manag')))
    problem = '客户关系管理，防止销售线索遗漏和跟进断档';
  else if (text.includes('project') && (text.includes('manag') || text.includes('track')))
    problem = '项目进度追踪，团队协作透明减少对齐成本';
  else if (text.includes('hr') || text.includes('payroll') || text.includes('onboard'))
    problem = 'HR 流程自动化，从入职到发薪减少人工操作';
  else if (text.includes('hire') || text.includes('recruit') || text.includes('talent'))
    problem = '招聘流程自动化，筛简历到约面试全程省时';
  else if (text.includes('feedback') || text.includes('survey') || text.includes('form'))
    problem = '用户反馈/问卷收集工具，快速获取产品改进信号';
  else if (text.includes('notif') || text.includes('alert') || text.includes('webhook'))
    problem = '实时通知/告警工具，关键事件第一时间触达负责人';
  else if (text.includes('password') || text.includes('auth') || text.includes('login') || text.includes('sso'))
    problem = '身份认证/密码管理，提升账号安全并减少登录摩擦';
  // —— 学习 & 健康 ——
  else if (text.includes('learn') || text.includes('course') || text.includes('tutor'))
    problem = '在线学习/辅导工具，降低获取专业技能的时间成本';
  else if (text.includes('health') || text.includes('fitness') || text.includes('workout'))
    problem = '健身/健康追踪工具，帮用户坚持良好生活习惯';
  else if (text.includes('sleep') || text.includes('wellness') || text.includes('meditat'))
    problem = '睡眠/冥想/健康管理，改善高压人群的日常状态';
  else if (text.includes('mental') || text.includes('therapy') || text.includes('anxiety'))
    problem = '心理健康工具，低成本获得情绪支持和压力管理';
  // —— 创作者 & 变现 ——
  else if (text.includes('creator') && text.includes('monetiz'))
    problem = '帮创作者建立付费变现渠道，摆脱平台高抽成';
  else if (text.includes('podcast'))
    problem = '播客制作/分发工具，降低音频内容生产和传播成本';
  else if (text.includes('substack') || text.includes('membership') || text.includes('paid') && text.includes('community'))
    problem = '付费会员/社区工具，帮创作者建立稳定的订阅收入';
  // —— 设计 ——
  else if (text.includes('design') && (text.includes('logo') || text.includes('brand')))
    problem = 'AI 生成 Logo/品牌视觉，初创公司省去设计外包费用';
  else if (text.includes('template') || text.includes('design'))
    problem = '设计模板工具，非设计师也能快速产出专业级图文';
  // —— 最终兜底：带产品名，拒绝空泛 ——
  else if (mrr)
    problem = `「${t}」— 已有真实付费用户，具体场景见原链接`;
  else
    problem = `「${t}」— 工具类产品，具体解决的问题见原链接`;

  // ── 2. 中国市场可复制性 ──────────────────────────────────────────────────
  const HIGH_CHINA = ['video','creator','content','social','marketing','ecommerce',
                      'schedule','seo','design','analytics','template','email','crm','短视频'];
  const LOW_CHINA  = ['crypto','nft','blockchain','gambling','dating','compliance',
                      'gdpr','hipaa','medicare','insurance','gun','weapon'];

  let chinaFit, chinaReason;
  if (LOW_CHINA.some(k => text.includes(k))) {
    chinaFit = 'low';
    chinaReason = '涉及受限领域，直接复制风险高';
  } else if (HIGH_CHINA.filter(k => text.includes(k)).length >= 2) {
    chinaFit = 'high';
    chinaReason = '国内同类需求旺盛，工具信息差大';
  } else if (HIGH_CHINA.some(k => text.includes(k))) {
    chinaFit = 'high';
    chinaReason = '对应国内真实需求，有本土化空间';
  } else if (text.includes('ai') || text.includes('saas')) {
    chinaFit = 'mid';
    chinaReason = 'AI/SaaS 赛道在国内有增量，需本土化';
  } else if (text.includes('developer') || text.includes('api') || text.includes('enterprise')) {
    chinaFit = 'mid';
    chinaReason = 'B2D/企业服务，付费意愿需单独验证';
  } else {
    chinaFit = 'mid';
    chinaReason = '通用工具，需评估国内实际市场规模';
  }

  // ── 3. 一人公司可行性 ────────────────────────────────────────────────────
  const SOLO_YES  = ['tool','widget','chrome','plugin','extension','api','webhook',
                     'notification','alert','tracker','monitor','generator','converter',
                     'calculator','summarizer','transcriber','scheduler','scraper'];
  const SOLO_HARD = ['marketplace','social network','community platform','hiring platform',
                     'freelance marketplace','two-sided','peer-to-peer','p2p network'];

  let soloFit, soloReason;
  if (SOLO_HARD.some(k => text.includes(k))) {
    soloFit = 'hard';
    soloReason = '双边/社区产品，冷启动需要团队资源';
  } else if (SOLO_YES.some(k => text.includes(k))) {
    soloFit = 'yes';
    soloReason = '工具型产品，技术+运营一人可驱动';
  } else if (text.includes('saas') || text.includes('automation') || text.includes('ai')) {
    soloFit = 'yes';
    soloReason = 'SaaS/AI 工具，无代码或小成本可验证';
  } else if (text.includes('content') || text.includes('newsletter') || text.includes('education')) {
    soloFit = 'yes';
    soloReason = '内容型业务，个人品牌驱动，一人起步';
  } else {
    soloFit = 'maybe';
    soloReason = '需结合具体功能范围评估开发量';
  }

  // ── MVP 和冷启动策略 ──────────────────────────────────────────────────────
  let mvp, coldStart;
  if (soloFit === 'hard') {
    mvp = '先聚焦单边用户，验证单边价值后再引入另一侧';
    coldStart = '锁定一个垂直行业/社区，免费获取第一批核心用户';
  } else if (soloFit === 'yes') {
    mvp = '最小功能集 4 周上线，免费额度获取早期用户反馈后付费化';
    coldStart = '上线当天发独立开发者群/产品猎人，前 100 名免费换口碑';
  } else {
    mvp = '拆解出可独立验证的核心子功能，先跑通 1 个完整付费流程';
    coldStart = '写 1-2 篇垂直内容（SEO 博客/抖音），吸引精准用户自然流入';
  }

  // 特定场景覆盖
  if (problem.includes('微信')) { coldStart = '垂直行业微信群/社群冷启动，转发给精准用户，口碑裂变'; }
  if (problem.includes('自由职业') || problem.includes('设计师')) { coldStart = '在 Behance/站酷/设计师群发布，针对设计师群体定向推广'; }
  if (problem.includes('电商') || problem.includes('卖家')) { coldStart = '电商运营类微信群/直播群直接推广，ROI 好的工具自发口碑传播'; }

  return { problem, chinaFit, chinaReason, soloFit, soloReason, mvp, coldStart };
}

// ─── 创新解法生成 ──────────────────────────────────────────────────────────
function generateSolution(problem, title) {
  const t = (problem + ' ' + title).toLowerCase();
  if (t.includes('转文字') || t.includes('transcri')) return 'Whisper 模型识别准确率 95%+，支持专业术语自定义词库，一小时录音 5 分钟出稿';
  if (t.includes('字幕') || t.includes('caption')) return '语音识别+大模型上下文翻译，一键生成精准 SRT 字幕，支持多语言批量导出';
  if (t.includes('冷邮件') || t.includes('cold email') || t.includes('outreach')) return 'AI 分析潜客资料生成个性化邮件序列，自动追踪打开率和回复，一人完成 SDR 工作量';
  if (t.includes('排期') || t.includes('schedule') || t.includes('发布')) return '内容一次创作，AI 自动适配各平台格式+最佳时间发布，数据分析哪个平台 ROI 最高';
  if (t.includes('视频') && t.includes('ai')) return '输入产品图片和卖点文案，AI 自动合成带口播的竖版短视频，批量生产投流素材';
  if (t.includes('seo') && t.includes('ai')) return '关键词→大纲→全文→内链，一篇 SEO 长文 15 分钟产出，可批量操作降低获客成本';
  if (t.includes('newsletter') || t.includes('邮件订阅')) return '邮件订阅+付费墙一体化，创作者直接拥有用户数据，绕开平台限流风险';
  if (t.includes('开票') || t.includes('账单') || t.includes('invoice')) return '自动识别交易记录生成账单，一键发送+付款提醒，在线收款+记账全流程打通';
  if (t.includes('归因') || t.includes('attribution')) return '多触点归因模型，追踪从首次点击到购买的完整路径，给出各渠道真实 ROI 排名';
  if (t.includes('crm') || t.includes('客户跟进')) return '微信聊天记录导入→自动整理客户档案→跟进提醒+业绩看板，专为中国销售场景设计';
  if (t.includes('简历') || t.includes('resume')) return '分析目标岗位 JD→提取关键词→重写简历，让简历通过 ATS 筛选的概率提升 60%+';
  if (t.includes('合同') || t.includes('legal')) return 'AI 高亮合同风险条款→逐条解释→给出修改建议，5 分钟完成人工需 2 小时的审阅';
  if (t.includes('监控') || t.includes('monitor') || t.includes('宕机')) return '全球节点每分钟探测，宕机 30 秒内微信/钉钉推送，附带性能瀑布图定位慢节点';
  if (t.includes('设计') || t.includes('logo')) return '输入品牌描述+风格偏好，AI 生成完整品牌视觉包，10 分钟替代外包设计师';
  if (t.includes('问卷') || t.includes('反馈') || t.includes('survey')) return 'AI 设计问卷逻辑→收集回答→聚类分析→输出可执行洞察报告，全流程 2 小时完成';
  if (t.includes('播客') || t.includes('podcast')) return '上传原始录音→AI 降噪+剪掉口误→生成文字稿+章节→一键分发到各平台';
  if (t.includes('excel') || t.includes('数据管理')) return '轻量在线数据库，表单录入+自动汇总+权限控制，手机端实时查看，告别 Excel 协作冲突';
  if (t.includes('库存')) return '手机扫码入出库，库存云端实时同步，低库存自动预警+生成补货单';
  if (t.includes('会议')) return '会议自动录音转文字→提取行动项→分配责任人→发送跟进提醒，会后 5 分钟出完整纪要';
  if (t.includes('考勤')) return 'GPS 地理围栏+人脸识别打卡，自动汇总出勤报表，异常自动标记等待审批';
  if (t.includes('排课')) return '输入约束条件（教师时间/教室容量/学生偏好），自动生成无冲突课表并推送通知';
  return '将核心流程 80% 的手工操作自动化，结合 AI 技术重新设计用户体验，用户只需处理例外情况';
}

// ─── 技术栈建议 ──────────────────────────────────────────────────────────
function suggestTechStack(category, soloFit) {
  const base = ['Next.js', 'Vercel'];
  if (category.includes('AI')) return { techStack: [...base, 'OpenAI API', 'Supabase', 'Tailwind CSS'], devTimeline: soloFit === 'yes' ? '1-3月' : '3-6月' };
  if (category.includes('数据') || category.includes('分析')) return { techStack: [...base, 'Supabase', 'Chart.js', 'Tailwind CSS'], devTimeline: '1-3月' };
  if (category.includes('营销') || category.includes('邮件')) return { techStack: [...base, 'Resend', 'Supabase', 'Tailwind CSS'], devTimeline: '1-3月' };
  if (category.includes('电商') || category.includes('支付')) return { techStack: [...base, 'Stripe', 'Supabase', 'Tailwind CSS'], devTimeline: '3-6月' };
  if (category.includes('视频') || category.includes('内容')) return { techStack: [...base, 'Cloudflare R2', 'FFmpeg', 'Supabase'], devTimeline: '3-6月' };
  if (category.includes('效率工具')) return { techStack: [...base, '微信小程序', 'Supabase'], devTimeline: '1-3月' };
  return {
    techStack: [...base, 'Supabase', 'Tailwind CSS'],
    devTimeline: soloFit === 'yes' ? '1-3月' : soloFit === 'maybe' ? '3-6月' : '6-12月',
  };
}

// ─── 资源需求评估 ─────────────────────────────────────────────────────────
function generateResourceNeeds(category, soloFit) {
  const needs = ['技术'];
  if (category.includes('设计') || category.includes('视频') || category.includes('内容') || category.includes('营销')) needs.push('设计');
  if (category.includes('营销') || category.includes('电商') || category.includes('社交')) needs.push('运营');
  if (soloFit === 'hard' || category.includes('AI')) needs.push('资金');
  return needs;
}

// ─── 痛点类型识别 ─────────────────────────────────────────────────────────
function generatePainType(problem) {
  const t = (problem || '').toLowerCase();
  if (t.includes('成本') || t.includes('费用') || t.includes('省去') || t.includes('外包') || t.includes('律师') || t.includes('降低') || t.includes('零库存')) return '成本';
  if (t.includes('心理') || t.includes('情绪') || t.includes('睡眠') || t.includes('冥想') || t.includes('焦虑') || t.includes('压力')) return '情感';
  if (t.includes('效率') || t.includes('自动') || t.includes('批量') || t.includes('一键') || t.includes('省时') || t.includes('快速') || t.includes('重复') || t.includes('释放') || t.includes('代替') || t.includes('7×24')) return '效率';
  return '体验';
}

// ─── AI 深度拆解（通义千问 Qwen，OpenAI 兼容格式）────────────────────────
async function analyzeWithClaude(title, desc, mrr) {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) return null;

  const prompt = `分析这个海外SaaS/工具产品，站在"一人创业者"视角判断中国市场机会。全部用中文简洁回答。

产品名：${title}
描述：${desc || '无详细描述'}
${mrr ? `月收入：${mrr}` : ''}

只返回 JSON，不要其他内容：
{
  "problem": "谁在痛、为什么痛（25字内，具体不泛指）",
  "solution": "用什么技术创新解决，核心差异点（30字内）",
  "chinaFit": "high、mid 或 low 之一",
  "chinaReason": "中国市场具体洞察，非模板话（20字内）",
  "soloFit": "yes、maybe 或 hard 之一",
  "soloReason": "一人开发的具体可行性（20字内）",
  "techStack": ["Next.js", "Supabase", "Vercel"],
  "devTimeline": "1-3月 或 3-6月 或 6-12月",
  "resourceNeeds": ["技术", "设计", "运营", "资金", "法律"],
  "painType": "效率 或 体验 或 成本 或 情感 之一",
  "mvp": "最小可验证产品方案（25字内）",
  "coldStart": "第一批用户从哪来（20字内）"
}`;

  try {
    const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
        enable_thinking: false,
      }),
    });
    if (!res.ok) { console.error('[Qwen] API error:', res.status, await res.text()); return null; }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const json = JSON.parse(match[0]);
    return json.problem ? json : null;
  } catch (e) { console.error('[Qwen] error:', e.message); return null; }
}

// ─── Product Hunt RSS (Atom) ──────────────────────────────────────────────
async function fetchProductHunt() {
  try {
    const res = await fetch('https://www.producthunt.com/feed', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IdeaRadar/1.0)' }
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.split('<entry>').slice(1);
    const results = [];

    for (const entry of entries.slice(0, 25)) {
      const title = (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').trim();
      const url = entry.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/)?.[1]?.trim() || '';
      if (!title || !url) continue;

      const rawDesc = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] || '';
      const desc = rawDesc
        .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
        .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0, 200);

      const pubDate = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() || '';
      const dateKey = pubDate ? new Date(pubDate).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);
      const { score, reason } = scoreItem(title, desc);
      const analysis = analyzeProduct(title, desc, null);

      const category = detectCategory(title + ' ' + desc);
      results.push({
        id: `ph-${Buffer.from(url).toString('base64').slice(0,16)}`,
        title: fixTitle(title), score, scoreReason: reason,
        ...analysis,
        solution: generateSolution(analysis.problem, title),
        ...suggestTechStack(category, analysis.soloFit),
        resourceNeeds: generateResourceNeeds(category, analysis.soloFit),
        painType: generatePainType(analysis.problem),
        desc: desc.slice(0, 300),
        url, source: 'producthunt', sourceLabel: 'Product Hunt',
        category,
        fetchedAt: new Date().toISOString(), dateKey,
      });
    }
    console.log(`[PH] ${results.length} 条`);
    return results;
  } catch (e) { console.error('PH error:', e.message); return []; }
}

// ─── TrustMRR ──────────────────────────────────────────────────────────────
async function fetchTrustMRR() {
  try {
    const res = await fetch('https://trustmrr.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IdeaRadar/1.0)' }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const today = new Date().toISOString().slice(0, 10);
    const results = [];
    const seen = new Set();
    const regex = /href="(\/startup\/[^"?#]+)"/g;
    let m;

    while ((m = regex.exec(html)) !== null) {
      const p = m[1];
      if (seen.has(p)) continue;
      seen.add(p);

      const slug = p.replace('/startup/', '');
      const rawTitle = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const title = fixTitle(rawTitle);

      const idx = html.indexOf(`"${p}"`);
      const nearby = html.slice(Math.max(0, idx-500), idx+500);
      const mrr = nearby.match(/\$[\d,]+(\.\d+)?[KkMm]?\s*(?:MRR|mrr)/)?.[0]?.trim();
      // TMRR 基础分 3：上面的都是有真实收入的产品
      const { score, reason } = scoreItem(title, '', mrr, 3);
      const analysis = analyzeProduct(title, mrr ? `verified mrr ${mrr}` : '', mrr);

      const tmrrCategory = detectCategory(title);
      results.push({
        id: `tmrr-${Buffer.from(p).toString('base64').slice(0,16)}`,
        title, score, scoreReason: reason,
        ...analysis,
        solution: generateSolution(analysis.problem, title),
        ...suggestTechStack(tmrrCategory, analysis.soloFit),
        resourceNeeds: generateResourceNeeds(tmrrCategory, analysis.soloFit),
        painType: generatePainType(analysis.problem),
        desc: mrr ? `verified mrr ${mrr}` : '',
        url: `https://trustmrr.com${p}`,
        source: 'trustmrr', sourceLabel: 'TrustMRR',
        mrr, category: tmrrCategory,
        fetchedAt: new Date().toISOString(), dateKey: today,
      });
    }
    console.log(`[TMRR] ${results.length} 条`);
    return results.slice(0, 25);
  } catch (e) { console.error('TMRR error:', e.message); return []; }
}

// ─── Reddit ───────────────────────────────────────────────────────────────
// 大社区（高热度门槛）+ 独立创客社区（低门槛，build-in-public 内容）
async function fetchReddit() {
  // minScore: 大社区需要高分才有信号价值；创客社区本来就小，低分也有价值
  const SUBS = [
    { name: 'SaaS',          minScore: 20 },
    { name: 'startups',      minScore: 20 },
    { name: 'entrepreneur',  minScore: 20 },
    { name: 'SideProject',   minScore: 5  },   // indie maker launches
    { name: 'microsaas',     minScore: 5  },   // micro-SaaS 专区
    { name: 'indiehackers',  minScore: 5  },   // build-in-public
  ];
  const KEEP = ['saas','tool','ai','launch','revenue','mrr','startup','product','automation',
                'api','indie','maker','software','app','platform','build','ship','idea',
                'just','month','hit','reached','$','k/mo','k mrr','k arr'];
  const results = [];
  const seen = new Set();

  for (const { name: sub, minScore } of SUBS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/top.json?t=day&limit=25`, {
        headers: { 'User-Agent': 'IdeaRadar/1.0 (personal aggregator)' }
      });
      if (!res.ok) continue;
      const json = await res.json();
      const posts = json?.data?.children || [];

      for (const { data: post } of posts) {
        if (!post.title || !post.url) continue;
        if ((post.score || 0) < minScore) continue;
        if (seen.has(post.id)) continue;
        seen.add(post.id);

        const t = post.title.toLowerCase();
        // 创客社区：所有帖子都保留（本来就是创业内容）；大社区：关键词过滤
        if (minScore >= 20 && !KEEP.some(k => t.includes(k))) continue;

        const title = fixTitle(post.title.trim());
        const desc = post.selftext ? post.selftext.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
        // MRR 里程碑帖评分更高
        const hasMrr = /\$[\d,]+[km]?\s*(mrr|arr|\/mo)/i.test(post.title + ' ' + (post.selftext || ''));
        const mrrStr = hasMrr ? (post.title + ' ' + (post.selftext || '')).match(/\$[\d,]+[km]?/i)?.[0] : null;
        const redditBase = post.score >= 200 ? 3 : (hasMrr ? 3 : 2);
        const { score, reason } = scoreItem(title, desc, mrrStr, redditBase);
        const analysis = analyzeProduct(title, desc, mrrStr);
        const dateKey = post.created_utc
          ? new Date(post.created_utc * 1000).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        const url = post.is_self
          ? `https://www.reddit.com${post.permalink}`
          : (post.url.startsWith('http') ? post.url : `https://www.reddit.com${post.permalink}`);

        const redditCategory = detectCategory(title + ' ' + desc);
        results.push({
          id: `reddit-${post.id}`,
          title, score, scoreReason: reason,
          ...analysis,
          solution: generateSolution(analysis.problem, title),
          ...suggestTechStack(redditCategory, analysis.soloFit),
          resourceNeeds: generateResourceNeeds(redditCategory, analysis.soloFit),
          painType: generatePainType(analysis.problem),
          desc: desc.slice(0, 300),
          mrr: mrrStr,
          url, source: 'reddit', sourceLabel: `r/${sub}`,
          redditScore: post.score,
          category: redditCategory,
          fetchedAt: new Date().toISOString(), dateKey,
        });
      }
    } catch (e) { console.error(`Reddit r/${sub} error:`, e.message); }
  }
  console.log(`[Reddit] ${results.length} 条`);
  return results.slice(0, 40);
}

// ─── Hacker News ─────────────────────────────────────────────────────────
async function fetchHackerNews() {
  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!res.ok) return [];
    const ids = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    const KEEP = ['show hn','ask hn','saas','tool','startup','ai','launch','maker',
                  'revenue','mrr','indie','product','automation','api'];
    const results = [];

    const items = await Promise.all(
      ids.slice(0, 60).map(id =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
          .then(r => r.json()).catch(() => null)
      )
    );

    for (const item of items) {
      if (!item || item.type !== 'story' || !item.title || !item.url) continue;
      if ((item.score || 0) < 50) continue;
      const t = item.title.toLowerCase();
      if (!KEEP.some(k => t.includes(k))) continue;

      const title = fixTitle(item.title);
      const desc = item.text ? item.text.replace(/<[^>]+>/g,' ').slice(0,200) : '';
      const { score, reason } = scoreItem(title, desc);
      const analysis = analyzeProduct(title, desc, null);
      const dateKey = item.time
        ? new Date(item.time * 1000).toISOString().slice(0, 10) : today;

      const hnCategory = detectCategory(title + ' ' + desc);
      results.push({
        id: `hn-${item.id}`,
        title, score, scoreReason: reason,
        ...analysis,
        solution: generateSolution(analysis.problem, title),
        ...suggestTechStack(hnCategory, analysis.soloFit),
        resourceNeeds: generateResourceNeeds(hnCategory, analysis.soloFit),
        painType: generatePainType(analysis.problem),
        desc: desc.slice(0, 300),
        url: item.url, source: 'hackernews', sourceLabel: 'Hacker News',
        hnScore: item.score,
        category: hnCategory,
        fetchedAt: new Date().toISOString(), dateKey,
      });
    }
    console.log(`[HN] ${results.length} 条`);
    return results;
  } catch (e) { console.error('HN error:', e.message); return []; }
}

// ─── Main ──────────────────────────────────────────────────────────────────
(async () => {
  console.log('开始抓取:', new Date().toISOString());
  
  // 抓取海外数据源
  const [ph, tmrr, reddit, hn] = await Promise.all([
    fetchProductHunt(), fetchTrustMRR(), fetchReddit(), fetchHackerNews()
  ]);
  
  // 抓取中文数据源
  console.log('开始抓取中文数据源...');
  const [zhihu, xhs] = await Promise.all([
    fetchZhihuData().catch(e => { console.error('知乎抓取失败:', e.message); return []; }),
    fetchXhsData().catch(e => { console.error('小红书抓取失败:', e.message); return []; })
  ]);
  
  // 补全知乎/小红书数据中缺失的新字段
  const GENERIC_MVP = ['核心功能最小化验证', '', undefined, null];
  const GENERIC_COLD = ['从垂直社群开始推广', '', undefined, null];
  const zhihuXhsItems = [...zhihu, ...xhs].map(item => {
    if (!item.solution) {
      item.solution = generateSolution(item.problem || item.title, item.title);
    }
    if (!item.techStack || !item.devTimeline) {
      const ts = suggestTechStack(item.category || '效率工具', item.soloFit || 'yes');
      if (!item.techStack) item.techStack = ts.techStack;
      if (!item.devTimeline) item.devTimeline = ts.devTimeline;
    }
    if (!item.resourceNeeds) item.resourceNeeds = generateResourceNeeds(item.category || '效率工具', item.soloFit || 'yes');
    if (!item.painType) item.painType = generatePainType(item.problem || '');
    // 使用 analyzeProduct 生成具体的 mvp/coldStart（替换占位符）
    if (GENERIC_MVP.includes(item.mvp) || GENERIC_COLD.includes(item.coldStart)) {
      const analysis = analyzeProduct(item.title, item.problem || '', item.mrr);
      if (GENERIC_MVP.includes(item.mvp)) item.mvp = analysis.mvp;
      if (GENERIC_COLD.includes(item.coldStart)) item.coldStart = analysis.coldStart;
    }
    return item;
  });

  const newItems = [...ph, ...tmrr, ...reddit, ...hn, ...zhihuXhsItems];
  console.log(`新抓取: ${newItems.length} 条 (海外: ${ph.length + tmrr.length + reddit.length + hn.length}, 中文: ${zhihu.length + xhs.length})`);

  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (_) {}

  const hasApiKey = !!process.env.QWEN_API_KEY;

  // 先合并数据
  const newIds = new Set(newItems.map(i => i.id));
  const merged = [...newItems, ...existing.filter(i => !newIds.has(i.id))].slice(0, 1000);

  // 分析所有缺少 AI 深度分析的条目（检查 solution 字段判断是否需要更新）
  if (hasApiKey) {
    const needAnalysis = merged.filter(i => !i.solution).slice(0, 200);
    console.log(`需 Claude 分析: ${needAnalysis.length} 条`);
    let done = 0;
    for (const item of needAnalysis) {
      const ai = await analyzeWithClaude(item.title, item.desc || '', item.mrr);
      if (ai) Object.assign(item, ai);
      process.stdout.write('.');
      done++;
      await new Promise(r => setTimeout(r, 400));
    }
    console.log(`\nClaude 分析完成 (${done} 条)`);
  } else {
    console.log('无 API Key，跳过 Claude 分析');
  }

  // 补全所有历史条目缺失的新字段（AI 分析后兜底）
  for (const item of merged) {
    if (!item.solution) item.solution = generateSolution(item.problem || item.title, item.title);
    if (!item.techStack || !item.devTimeline) {
      const ts = suggestTechStack(item.category || '数字工具', item.soloFit || 'maybe');
      if (!item.techStack) item.techStack = ts.techStack;
      if (!item.devTimeline) item.devTimeline = ts.devTimeline;
    }
    if (!item.resourceNeeds) item.resourceNeeds = generateResourceNeeds(item.category || '数字工具', item.soloFit || 'maybe');
    if (!item.painType) item.painType = generatePainType(item.problem || '');
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2));
  console.log(`保存完成: 共 ${merged.length} 条`);
})();
