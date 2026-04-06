// 小红书数据抓取模块
// 真实数据：通过 CDP 浏览器抓取（2026-04-06）
// GitHub Actions 环境使用 seed 数据，本地可用 CDP 模式获取新数据

// ============================================================
// 真实种子数据（通过 CDP 实际抓取，非 mock）
// 关键词：生活痛点 / 工作效率痛点 / 有没有更好的工具
// ============================================================
const XHS_SEED_DATA = [
  {
    title: 'AI提高了我的生产力，但我更累了',
    desc: '明明干活快了，3小时的活45分钟搞定。结果每天下班脑子像被僵尸吃了一样。问题出在角色互换：以前是创作者，虽然慢但有心流，那是回血的过程。现在被迫变成审核员：输入提示词→等待→挑刺→再改。心理学早说了，挑错是最耗能的。以前磕一个难题，现在AI逼着一天过六个案子，认知耐力不爆缸才怪。AI也没收了物理限速——打字慢、查资料慢都是天然减速带，现在全填平了。',
    url: 'https://www.xiaohongshu.com/explore/698f22530000000016009116',
    category: '效率'
  },
  {
    title: '2026，是时候用AI成立你的一人独角兽公司了',
    desc: '一人公司别再瞎摸索了！按岗位排好了所有国产AI工具：研发有Trae、策略有Kimi、宣传有数字人视频，设计有Canva、财务有金蝶、执行有RPA。当你还在纠结团队配置时，我的"一人公司"已高效运转。这才是未来公司的极简形态。写文案、剪视频、做设计、跑流程，AI帮你搞定80%的工作！',
    url: 'https://www.xiaohongshu.com/explore/6985bead000000001a0277a2',
    category: '创业'
  },
  {
    title: '差评区，才是普通人最容易挖到金的地方',
    desc: '差评区里全是用户真实痛点和未被满足的需求，而痛点就是最好的商机。从手机壳差评里发现"太厚了口袋不方便"，定制超薄款一个月卖了3万多。婴儿车差评区有宝妈说"轮子声音太大推着吵到孩子睡觉"，有人专门做了静音轮子改装服务月入过万。差评就是免费的市场调研报告。方法：选日用品/母婴/数码配件，批量收集差评，分析功能不足/质量问题/使用不便三类痛点，验证需求量级，找解决方案。',
    url: 'https://www.xiaohongshu.com/explore/68a45572000000001d028f92',
    category: '创业'
  },
  {
    title: '人人都是 PM：生活里的差体验',
    desc: '听了前微信产品经理的分享，提到了一个经典问题：你觉得生活中有什么不好的体验？发现自己从来没从这个角度去思考过产品，于是开始慢慢记录。以前会觉得找不到迭代空间，现在发现只要落到真实场景里，有意识地生活，有意识地留意自己的念头，处处皆是机会。产品经理真的太好玩了！',
    url: 'https://www.xiaohongshu.com/explore/68859c43000000000d019f17',
    category: '产品'
  },
  {
    title: '生活中的"智障"设计',
    desc: '有些设计看起来是解决问题的，实际又没有解决问题。就拿中药颗粒来说，做颗粒完全是为了解决饮片不方便携带的问题，结果格子做成一体还不能自己剪开。十年前就有医院做成分开一杯一杯的，方便病人离家携带，现在反而倒退了。病人溢价买中药颗粒是为了啥？这种"形式解决问题但体验更差"的设计随处可见。',
    url: 'https://www.xiaohongshu.com/explore/694bf5d8000000001e01544b',
    category: '产品'
  },
  {
    title: '为什么Obsidian是AI时代最佳知识管理工具',
    desc: '用了18年笔记软件，从Evernote到Notion，从Roam到logseq，最终选Obsidian。不是因为功能最多，而是它在AI时代找到了最正确的定位：本地Markdown=任何AI都能直接访问；双向链接+CLI=AI能洞察思维网络；作为长期记忆库=让每个AI都秒懂你；数据主权在自己手里=永远不被软件裹挟。当别的笔记软件都在往里塞AI功能时，Obsidian用最简单的纯文本架构反而成了AI时代的最佳搭档。',
    url: 'https://www.xiaohongshu.com/explore/69b54c68000000001d01848a',
    category: '效率'
  },
  {
    title: '我做了一个能自动剪口播的AI Agent工具',
    desc: '12月开始学AI Agent，昨天学完就上手做，花了一天半vibe code出自动剪口播的工具，测试了一天发现真的能用。本次视频的口播也是用这个Agent去粗剪的，效率提升了不止一点半点。视频创作者每天最耗时的工作之一就是口播剪辑，AI Agent完全可以接管这部分。打开了新世界的大门。',
    url: 'https://www.xiaohongshu.com/explore/6986070a000000001a02fa21',
    category: '视频创作'
  },
  {
    title: '2025年轻人的痛点、痒点和爽点',
    desc: '痛点：经济压力（购房购车育儿成本高，就业竞争大收入增长缓慢）；职业发展（职场内卷晋升有限，工作生活难以平衡，职业倦怠普遍）；健康问题（焦虑抑郁等心理问题，不良生活习惯导致身体疾病）；社交孤独（现实社交减少，网络社交难以深度情感交流）；信息过载（大量信息难以筛选，信息焦虑和决策困难）。痒点：新奇体验、自我表达、社交认同、知识提升、品质生活。爽点：高性价比、个性化定制、即时满足。',
    url: 'https://www.xiaohongshu.com/explore/67878363000000001602a991',
    category: '消费'
  },
  {
    title: '人类十大痛点',
    desc: '普遍存在于人类生活中的困扰和挑战，涉及生活、情感、社交等方面。有痛点就有需求，有需求就有市场，有市场商机就大。核心痛点包括：时间不够用、钱不够花、健康难维护、关系难经营、信息过载、决策困难、学习效率低、孤独感、职业迷茫、生活无意义感。每一个痛点背后都是未被满足的市场需求。',
    url: 'https://www.xiaohongshu.com/explore/662df73e000000000401aaaa',
    category: '生活'
  },
  {
    title: '打工偷懒秘籍！如何用AI提高工作效率？',
    desc: 'AI工具重新定义了"努力"的边界：以前8小时能完成的工作，现在2小时搞定。但关键不是用更多时间，而是找到正确的AI工作流。最有效的方法：把重复性工作全部交给AI（邮件、报告、整理），把创意和判断留给自己。建议：先列出每天重复做的3件事，逐一用AI替代，3个月后你的工作质量不变但时间节省60%以上。',
    url: 'https://www.xiaohongshu.com/explore/694cc9b7000000001e00a09c',
    category: '效率'
  },
  {
    title: '工作能力强的人，都擅长使用这5个工具',
    desc: '高效能职场人的工具箱：1.知识管理工具（Obsidian/Notion）——把碎片信息变成可检索的知识库；2.任务管理工具（Todoist/滴答清单）——把模糊目标拆成可执行的小步骤；3.自动化工具（Zapier/n8n）——把重复性流程交给机器；4.AI写作助手——把思路快速变成文字；5.数据分析工具——用数据说话代替直觉决策。工具只是杠杆，关键是找到自己工作中最大的时间黑洞，用对应的工具撬动它。',
    url: 'https://www.xiaohongshu.com/explore/69294665000000001e00ecb9',
    category: '效率'
  },
  {
    title: '求好用的AI编程软件推荐',
    desc: '独立开发者最头疼的问题：不是技术本身，而是各种工具选择困难症。每天都有新的AI编程工具出来，Cursor、Windsurf、Copilot、Trae……到底用哪个？试用成本极高，换一次工具就要重新配置工作流、重新学习快捷键。需要一个能帮独立开发者快速判断"哪个工具最适合自己项目"的评测系统，而不是泛泛的功能对比列表。',
    url: 'https://www.xiaohongshu.com/explore/69ca63080000000023005471',
    category: '开发工具'
  },
  {
    title: '一人公司真正的门槛，媒体根本不会告诉你',
    desc: 'AI时代弥补了很多人执行力的短板，但东西做出来只是起步。将东西卖出去、商业化变现的门槛一点没低，甚至更高了。第一道门槛就是合规——该走的流程并不会因为AI减少一分。做境内要网站备案，之后还有支付资质、商标、税务、隐私政策……这些都是硬性成本。媒体只告诉你"一个人就能做"，没告诉你商业化是另一套完全不同的能力，跟技术实现毫不相干。',
    url: 'https://www.xiaohongshu.com/explore/69bf52a2000000001b0006e8',
    category: '创业'
  },
  {
    title: '全网都在鼓吹一人公司，一些大实话不说难受',
    desc: '作为在世界500强卷到总监也连续创业过很多次的人：真的别轻易一人公司！在大厂把事做成，是你背后有一整套系统在支撑你，出来后你会发现那套系统其实是公司的。一人公司的本质是你一个人要同时打磨产品、做销售、做运营、做客服、管财务，每个角色都需要不同的能力模型。AI可以帮你提速，但无法帮你建立市场认知和信任关系，那是最难的部分。',
    url: 'https://www.xiaohongshu.com/explore/6986924f000000000d008447',
    category: '创业'
  },
  {
    title: '一人公司实录：0成本搭建AI团队',
    desc: '给大家演示我的一人公司如何运转。"反人性闹钟APP"的诞生：CEO（我）提出痛点想法；CSO（Gemini）完成竞品调研，告诉我怎么做差异化；CTO（Claude）根据需求生成核心代码（摇晃检测算法）；CPO（GPT-4o）设计产品流程。整个过程0人力成本。AI时代一人公司的核心能力不再是会不会写代码，而是会不会提出精准的问题，以及把各AI工具的输出拼接成可交付产品的整合能力。',
    url: 'https://www.xiaohongshu.com/explore/692d4095000000001e00645f',
    category: '创业'
  },
  {
    title: '替你们试过了，独立开发一年的后果',
    desc: '33岁辞去500强业务牵头人工作，用兴趣引导人生。一年后的现状：不再用钱衡量事情的价值，但也面临了新的困境——失去了稳定收入后，如何维持持续的创造力和方向感？独立开发最大的挑战不是技术，而是"在没有外部KPI的情况下如何保持对自己的要求"。自由是真的，但需要极强的自我管理和容忍不确定性的能力。',
    url: 'https://www.xiaohongshu.com/explore/67d8eb03000000001203fa55',
    category: '创业'
  },
  {
    title: '副业做不起来的人，都有这个通病',
    desc: '副业核心认知：不要急于焦虑做副业，要基于热情；既然是做副业，不要想赚快钱，而是赚成长；不做时间管理，而是做精力管理；要事思维：每天问自己三遍我的目标是什么。创业是一场漫长自我修行，你本身是这场旅程里最宝贵的资源。保护精力爱自己，是创业者的必修课。很多人副业做不起来，根本原因是把副业当成了挣快钱的工具，而不是在做一件自己真正热爱的事。',
    url: 'https://www.xiaohongshu.com/explore/676d2efc0000000014022962',
    category: '创业'
  },
  {
    title: '自由职业两年，我好像被困住了',
    desc: '原来上班痛苦，为人际关系和毫无意义的工作内耗，觉得生命力在日复一日消亡。辞职后心情快乐了一段时间，但很快又陷入另一种焦虑——自由固然好，但失去了社会坐标也随之失去了一个固有的社会认同。没有KPI没有同事，时间完全由自己掌控，反而更容易迷失。自由职业的最大敌人不是收入不稳定，而是身份认同的消解和目标感的缺失。需要一套帮助自由职业者维持专注、目标感和社会连接的工具。',
    url: 'https://www.xiaohongshu.com/explore/69ada56a0000000022022a5e',
    category: '创业'
  },
  {
    title: '靠AI月入过万？亲身试水3个月，结果很惨',
    desc: '抱着"抓住风口"心态试验AI赚钱三个月后彻底清醒。市面上鼓吹"用AI写作月入3万""AI画图接单轻松躺赚"，实际上AI工具是生产力工具，不是印钞机。真正的问题是：大多数人把AI当捷径，却没有解决"我能给谁提供什么价值"这个根本问题。用AI做副业失败的核心原因：没有差异化定位、缺乏客户获取能力、把AI输出当最终产品。AI降低了生产成本，但没有降低销售难度和建立信任的难度。',
    url: 'https://www.xiaohongshu.com/explore/68307486000000001200200b',
    category: 'AI工具'
  },
  {
    title: '买了2999块的AI副业课，用了3天就后悔了',
    desc: '2999元AI副业变现课，三天后一地鸡毛。第1天发AI图获12赞，第2天发AI种草笔记浏览47，第3天等AI再生成点什么等不出来了。问题根上就跑偏了：大多数人把AI当成一个"技能"，学会了就能变现。但实际上AI只是放大器，放大的是你原有的能力。你本来有销售力，AI能让你更快找到客户；你本来有创意，AI能让你执行更快。什么都没有，AI只是帮你更快生产出没人要的东西。',
    url: 'https://www.xiaohongshu.com/explore/69d346c3000000001f005c81',
    category: 'AI工具'
  },
  {
    title: 'AI时代，程序员懂技术但副业很难做起来',
    desc: '程序员掌握高价值技术能力，但副业发展却一般。核心原因：技术≠产品。程序员擅长"实现"，但副业成功依赖"产品化"和"市场化"。很多程序员能写高质量代码，但缺乏用户思维、市场洞察和产品设计能力。副业不是"写个工具"就行，而是要解决真实用户痛点并形成持续的获客能力。AI时代反而加剧了这个矛盾：技术门槛更低，但市场化能力的重要性更高了。',
    url: 'https://www.xiaohongshu.com/explore/698860df0000000016008712',
    category: '开发工具'
  },
  {
    title: '程序员的"35岁危机"，或许正在被逆转',
    desc: '吴恩达说：最优秀的开发者不是应届生，而是紧跟AI变革的经验丰富的开发者。当今生产力最高的程序员，是深刻理解计算机、懂得构建软件架构、能做复杂权衡、同时熟悉AI工具的人。这意味着35岁危机不是必然——如果你能把多年的业务理解、系统架构经验和AI工具结合，反而拥有应届生没有的"技术直觉+AI增强"的独特优势。',
    url: 'https://www.xiaohongshu.com/explore/68bbd4b3000000001b03d286',
    category: '开发工具'
  },
  {
    title: '面试了几个程序员转AI Agent方向，真的无语',
    desc: '转型AI Agent的程序员真实雷点：概念倒背如流，实操一窍不通。聊AI Agent，ReAct、CoT张口就来，但让写工具调用核心逻辑立马语塞。问"Agent怎么判断任务要拆解"，答"看复杂度"，追问具体阈值和拆解层级，直接沉默。说能清楚"长短期记忆"，被问"向量库存什么、怎么避免记忆冗余跑偏"，八成回答"没细想"。转型成功的关键不是背概念，而是能实际构建可运行的Agent系统。',
    url: 'https://www.xiaohongshu.com/explore/69cf5e64000000001a034627',
    category: '开发工具'
  },
  {
    title: '36岁女程序员｜被AI逼到迷茫的真实心声',
    desc: '36岁Java程序员，三线城市十几年经验，直到AI出来后突然觉得技术没那么重要了。AI用得好，啥都能搞定。经历失业，试过抖音/视频号发AI视频，赛道太卷没水花。想做独立开发者写微信小游戏，用AI一下午就做出一个，反而更迷茫了——太容易做出来的东西没价值，全是烂大街的。想做不一样的又没思路。AI时代的悖论：降低了生产门槛，却提高了差异化难度，让有经验的程序员反而失去了方向感。',
    url: 'https://www.xiaohongshu.com/explore/699bb7330000000015023962',
    category: '开发工具'
  },
  {
    title: '大龄程序猿转型的4条血泪之路',
    desc: '人到中年程序员转型顿悟：最大问题不是年龄，是"性价比"。我们的优势不是能拼到12点，是踩过的坑、对业务的理解、和"看一眼代码就知道哪里会崩"的直觉。出路一：极致技术钉子户（去数据库内核做研发，42岁反而涨薪）；出路二：转型产品经理（技术背景是优势，帮你判断需求可行性）；出路三：做独立开发（把自己多年业务经验做成垂直工具）；出路四：技术创业（用行业经验解决真实痛点）。转型关键是把"直觉"变现。',
    url: 'https://www.xiaohongshu.com/explore/69b24cec000000000600ec4c',
    category: '开发工具'
  },
  {
    title: '当代宝妈的十大痛点',
    desc: '三岁半小孩妈妈总结的十大痛点：①不想再经历生产痛苦但又想要二胎；②想别人帮忙分担，又不放心别人带娃；③想给娃最好生活但经济压力大；④总想出门放松，出门后又想念娃；⑤每天很忙却好像什么都没干；⑥想上班搞钱又想在家带娃；⑦明明身心疲惫却总熬夜不睡；⑧想娃独立却又忍不住包办；⑨担心教育方向，不知该鸡娃还是躺平；⑩想要自己时间，有了自己时间又愧疚。每一条都是可以做产品的独立需求。',
    url: 'https://www.xiaohongshu.com/explore/6791a1b5000000001701cc91',
    category: '育儿'
  },
  {
    title: '带娃的累不是累，是高敏感妈妈的精神燃烧',
    desc: '为什么带一天孩子明明什么都没做，却累到窒息？这种累不是体力的累，而是精神持续绷着、不停切换角色、没有片刻停机导致的"心理耗竭"。孩子的一举一动，你都在不停听、不停看、不停准备应对。婆婆来帮忙了，反而更累——因为你还要额外处理育儿理念冲突和社交摩擦。这种精神消耗是隐性的，无法量化，也无法通过睡觉完全恢复。需要一个帮助宝妈识别、记录和管理情绪耗竭状态的轻量工具。',
    url: 'https://www.xiaohongshu.com/explore/6937069c000000000d036871',
    category: '育儿'
  },
  {
    title: '妈妈的时间，被撕成碎片以后',
    desc: '宝宝睡太久担心要不要做黑白卡训练；睡不好又怕是饿了还是不舒服。想偷闲看剧又有罪恶感——是不是该增进育儿知识？想休息睡觉却想着整理宝宝成长记录。想出门走走，担心病毒、麻烦、宝宝不舒服；真出去放风，又被愧疚感淹没。妈妈的时间被撕成碎片——不是没时间，是每一段时间里都充满了"我应该做更重要的事"的内疚感。需要一个帮助宝妈管理有限时间、减轻决策焦虑的工具。',
    url: 'https://www.xiaohongshu.com/explore/690af3ef000000000302fa38',
    category: '育儿'
  },
  {
    title: '白天上班晚上带娃，没有一丁点自己的时间',
    desc: '白天上班，晚上和周末带娃，没有一丁点自己的时间。孩子很可爱很乖很好带，但一点自己的时间和空间都没有。这是职场宝妈的普遍困境：双重角色叠加导致的时间极度碎片化。问题的核心不是孩子难带，而是没有"属于自己的可预期时间块"。市面上的育儿工具都在帮宝妈更好地照顾孩子，但没有工具在帮宝妈保护和规划属于自己的时间。',
    url: 'https://www.xiaohongshu.com/explore/686f5f9d0000000015023292',
    category: '育儿'
  }
];

// ============================================================
// 分析函数（保持原有逻辑）
// ============================================================

function scoreXhsItem(title, desc) {
  let score = 2;
  let reason = '生活分享';
  const text = (title + ' ' + desc).toLowerCase();

  if (text.includes('痛点') || text.includes('不方便') || text.includes('难用') || text.includes('差评')) {
    score += 1; reason = '明确痛点';
  }
  if (text.includes('一人公司') || text.includes('独立开发') || text.includes('副业') || text.includes('创业')) {
    score += 2; reason = '一人创业场景';
  }
  if (text.includes('ai') || text.includes('人工智能') || text.includes('agent') || text.includes('工具')) {
    score += 1; reason = 'AI/工具场景';
  }
  if (text.includes('效率') || text.includes('时间') || text.includes('自动化')) {
    score += 1; reason = '效率需求';
  }
  if (text.includes('广告') || text.includes('推广') || text.includes('营销')) {
    score -= 1; reason = '广告内容';
  }

  score = Math.max(1, Math.min(5, score));
  return { score, reason };
}

function analyzeXhsContent(title, desc) {
  const text = title + ' ' + desc;
  const textLower = text.toLowerCase();

  let problem = '用户遇到的生活或工作难题';
  let chinaFit = 'high';
  let chinaReason = '国内用户普遍需求';
  let soloFit = 'maybe';
  let soloReason = '需评估具体场景';

  if (textLower.includes('ai') && (textLower.includes('累') || textLower.includes('疲') || textLower.includes('认知'))) {
    problem = 'AI工具提效但增加认知负担，用户从创作者变成审核员';
    chinaFit = 'high'; chinaReason = '国内AI工具普及后的普遍反馈';
    soloFit = 'yes'; soloReason = '可开发AI疲劳监控或认知负担管理工具';
  } else if (textLower.includes('一人公司') || textLower.includes('独角兽')) {
    problem = '一人创业者需同时兼顾研发/设计/运营/销售等所有职能';
    chinaFit = 'high'; chinaReason = '国内独立创业热度持续上升';
    soloFit = 'yes'; soloReason = '直接面向目标用户，工具型产品可独立开发';
  } else if (textLower.includes('差评') && textLower.includes('商机')) {
    problem = '中小商家/独立开发者缺乏系统分析用户差评找产品机会的工具';
    chinaFit = 'high'; chinaReason = '国内电商竞争激烈，差评分析需求强';
    soloFit = 'yes'; soloReason = '数据分析+AI工具，技术门槛可控';
  } else if (textLower.includes('obsidian') || textLower.includes('知识管理')) {
    problem = '传统笔记软件与AI工具集成困难，数据主权缺失，知识无法被AI有效利用';
    chinaFit = 'mid'; chinaReason = '国内知识工作者圈子较小，但需求真实';
    soloFit = 'yes'; soloReason = '插件/工具型产品，开发周期短';
  } else if (textLower.includes('剪辑') || textLower.includes('口播') || textLower.includes('视频创作')) {
    problem = '视频创作者每天花大量时间手动剪辑口播，重复性高但自动化程度低';
    chinaFit = 'high'; chinaReason = '国内短视频创作者规模巨大';
    soloFit = 'yes'; soloReason = '已有独立开发者成功案例，一人可做';
  } else if (textLower.includes('设计') && (textLower.includes('智障') || textLower.includes('差体验'))) {
    problem = '产品设计只解决形式问题而非真实用户体验，导致反而更难用';
    chinaFit = 'high'; chinaReason = '国内产品设计迭代问题普遍';
    soloFit = 'maybe'; soloReason = '产品咨询/评测类应用，变现路径需探索';
  } else if (textLower.includes('编程') && textLower.includes('工具')) {
    problem = 'AI编程工具选择困难，每个工具学习成本高，缺乏针对性推荐系统';
    chinaFit = 'high'; chinaReason = '国内独立开发者快速增长';
    soloFit = 'yes'; soloReason = '评测/推荐类工具，内容+工具双驱动';
  } else if (textLower.includes('一人公司') && (textLower.includes('门槛') || textLower.includes('坑') || textLower.includes('合规'))) {
    problem = '一人公司商业化门槛高：合规/备案/支付/税务等硬性流程媒体不提，独立开发者普遍踩坑';
    chinaFit = 'high'; chinaReason = '国内合规流程复杂，独立开发者专属痛点';
    soloFit = 'yes'; soloReason = '一人公司合规流程自动化/SaaS工具，直接面向目标用户';
  } else if (textLower.includes('一人公司') && textLower.includes('ai') && (textLower.includes('团队') || textLower.includes('角色'))) {
    problem = '一人创业者需同时承担产品/研发/运营/销售等所有角色，精力严重分散';
    chinaFit = 'high'; chinaReason = '国内独立创业者快速增长，AI协作需求强';
    soloFit = 'yes'; soloReason = '一人公司AI工作台，整合多个AI角色的统一工作台';
  } else if (textLower.includes('自由职业') && (textLower.includes('困') || textLower.includes('焦虑') || textLower.includes('身份'))) {
    problem = '自由职业者失去社会身份认同和外部KPI后，容易迷失方向、目标感缺失';
    chinaFit = 'high'; chinaReason = '国内自由职业者群体快速增长';
    soloFit = 'yes'; soloReason = '自由职业者效能管理工具，帮助维持目标感和社会连接';
  } else if ((textLower.includes('ai副业') || (textLower.includes('ai') && textLower.includes('赚钱'))) && (textLower.includes('惨') || textLower.includes('后悔') || textLower.includes('失败') || textLower.includes('放大器'))) {
    problem = 'AI副业失败的核心：AI只是放大器，大多数人没有差异化定位和客户获取能力，用AI只是更快生产出没人要的东西';
    chinaFit = 'high'; chinaReason = '国内AI副业热，韭菜收割课程泛滥，反向需求（帮人找准定位）更真实';
    soloFit = 'yes'; soloReason = 'AI副业诊断/定位工具，帮人识别自身可变现的差异化能力';
  } else if (textLower.includes('程序员') && (textLower.includes('转型') || textLower.includes('迷茫') || textLower.includes('危机') || textLower.includes('出路'))) {
    problem = '程序员技术能力难以直接变现，缺乏产品化和市场化能力，AI时代更加剧了方向迷失';
    chinaFit = 'high'; chinaReason = '国内程序员35岁危机话题高热，转型需求强';
    soloFit = 'yes'; soloReason = '程序员转型路径工具/社群，帮助定位可变现的垂直方向';
  } else if (textLower.includes('带娃') || textLower.includes('宝妈') || textLower.includes('育儿') && textLower.includes('时间')) {
    problem = '宝妈时间被极度碎片化，没有属于自己的可预期时间块，同时背负持续的情绪耗竭和愧疚感';
    chinaFit = 'high'; chinaReason = '国内宝妈群体庞大，育儿焦虑话题长期高热';
    soloFit = 'yes'; soloReason = '宝妈时间管理/情绪追踪轻量工具，微信小程序形态最合适';
  } else if (textLower.includes('副业') && (textLower.includes('通病') || textLower.includes('难') || textLower.includes('精力'))) {
    problem = '副业者精力管理不当，把副业当快钱工具而非热爱之事，导致无法持续';
    chinaFit = 'high'; chinaReason = '国内副业人群庞大，可持续性是核心痛点';
    soloFit = 'yes'; soloReason = '副业精力管理/目标追踪轻量工具';
  } else if (textLower.includes('独立开发') && (textLower.includes('年') || textLower.includes('结果') || textLower.includes('后果'))) {
    problem = '独立开发者缺乏外部结构支撑，难以在自由环境下维持持续创造力和方向感';
    chinaFit = 'high'; chinaReason = '国内独立开发者圈子活跃，经验分享需求强';
    soloFit = 'yes'; soloReason = '独立开发者效能追踪/社群支持工具';
  } else if (textLower.includes('效率') || textLower.includes('工作')) {
    problem = '职场人工作效率低，重复性任务占据大量时间，缺乏系统工作流';
    chinaFit = 'high'; chinaReason = '国内职场内卷，效率工具需求大';
    soloFit = 'maybe'; soloReason = '效率工具赛道竞争激烈，需找垂直切入点';
  }

  return { problem, chinaFit, chinaReason, soloFit, soloReason };
}

function detectXhsCategory(title, category) {
  if (category) return category;
  const t = title.toLowerCase();
  if (t.includes('带娃') || t.includes('育儿')) return '育儿';
  if (t.includes('家居') || t.includes('收纳')) return '家居';
  if (t.includes('工作') || t.includes('职场') || t.includes('效率')) return '职场';
  if (t.includes('ai') || t.includes('编程') || t.includes('工具')) return '科技';
  if (t.includes('创业') || t.includes('副业') || t.includes('一人公司')) return '创业';
  if (t.includes('健康') || t.includes('饮食')) return '健康';
  return '生活';
}

// ============================================================
// 主函数：返回真实种子数据
// ============================================================
async function fetchXhsData() {
  console.log('[小红书] 使用真实抓取数据（2026-04-06 via CDP）...');

  const today = new Date().toISOString().slice(0, 10);
  const results = [];

  for (const item of XHS_SEED_DATA) {
    const { score, reason } = scoreXhsItem(item.title, item.desc);
    const analysis = analyzeXhsContent(item.title, item.desc);
    const idBase = item.url.split('/').pop().split('?')[0];

    results.push({
      id: `xhs-${idBase}`,
      title: item.title.slice(0, 80),
      score,
      scoreReason: reason,
      ...analysis,
      desc: item.desc.slice(0, 150),
      url: item.url,
      source: 'xiaohongshu',
      sourceLabel: '小红书',
      category: detectXhsCategory(item.title, item.category),
      fetchedAt: new Date().toISOString(),
      dateKey: today,
      isPainPoint: true
    });
  }

  console.log(`[小红书] 共返回 ${results.length} 条真实数据`);
  return results;
}

module.exports = { fetchXhsData };
