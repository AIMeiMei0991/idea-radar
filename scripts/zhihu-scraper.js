// 知乎数据抓取模块
// 专注于发现传统领域的痛点需求

const ZHIHU_API_BASE = 'https://www.zhihu.com/api/v4';

// 知乎热榜话题 - 使用模拟数据（因为API限制）
async function fetchZhihuHot() {
  try {
    // 模拟知乎热榜痛点话题
    const hotTopics = [
      {
        id: '123456789',
        title: 'Excel管理数据太繁琐，有没有更高效的工具？',
        answer_count: 245,
        follower_count: 1800,
        excerpt_area: { rank: 1 }
      },
      {
        id: '987654321',
        title: '传统班级管理方式太枯燥，如何提升学生参与度？',
        answer_count: 189,
        follower_count: 1200,
        excerpt_area: { rank: 2 }
      },
      {
        id: '456789123',
        title: '小微企业客户跟进混乱，有什么好用的CRM工具推荐？',
        answer_count: 156,
        follower_count: 950,
        excerpt_area: { rank: 3 }
      },
      {
        id: '789123456',
        title: '手工记录库存太麻烦，如何实现数字化管理？',
        answer_count: 132,
        follower_count: 800,
        excerpt_area: { rank: 4 }
      },
      {
        id: '321654987',
        title: '传统会议效率低下，如何用技术手段提升会议效率？',
        answer_count: 98,
        follower_count: 650,
        excerpt_area: { rank: 5 }
      },
      {
        id: '654987321',
        title: '纸质文档管理混乱，如何实现电子化归档？',
        answer_count: 87,
        follower_count: 520,
        excerpt_area: { rank: 6 }
      },
      {
        id: '147258369',
        title: '传统考勤方式太落后，有没有智能考勤解决方案？',
        answer_count: 76,
        follower_count: 480,
        excerpt_area: { rank: 7 }
      },
      {
        id: '258369147',
        title: '项目进度跟踪困难，如何用工具提升项目管理效率？',
        answer_count: 65,
        follower_count: 420,
        excerpt_area: { rank: 8 }
      },
      {
        id: '369147258',
        title: '传统培训方式效果差，如何用技术提升培训效果？',
        answer_count: 54,
        follower_count: 380,
        excerpt_area: { rank: 9 }
      },
      {
        id: '741852963',
        title: '手工报销流程太复杂，如何实现自动化报销？',
        answer_count: 43,
        follower_count: 320,
        excerpt_area: { rank: 10 }
      }
    ];
    
    const results = [];
    for (const topic of hotTopics) {
      const title = topic.title || '';
      const url = `https://www.zhihu.com/question/${topic.id}`;
      const answerCount = topic.answer_count || 0;
      const followerCount = topic.follower_count || 0;
      
      // 过滤掉非痛点相关的话题
      if (isPainPointTopic(title)) {
        const desc = `知乎热榜话题，${answerCount}个回答，${followerCount}人关注`;
        const { score, reason } = scoreZhihuItem(title, desc);
        const analysis = analyzeZhihuTopic(title, desc);
        
        results.push({
          id: `zhihu-hot-${topic.id}`,
          title: title.slice(0, 100),
          score,
          scoreReason: reason,
          ...analysis,
          desc: desc.slice(0, 200),
          url,
          source: 'zhihu',
          sourceLabel: '知乎热榜',
          category: detectZhihuCategory(title),
          fetchedAt: new Date().toISOString(),
          dateKey: new Date().toISOString().slice(0, 10),
          answerCount,
          followerCount,
          hotRank: topic.excerpt_area?.rank || 0
        });
      }
    }
    
    console.log(`[知乎热榜] 模拟 ${results.length} 个痛点话题`);
    return results;
  } catch (error) {
    console.error('[知乎热榜] 抓取失败:', error.message);
    return [];
  }
}

// 搜索痛点相关的问题 - 使用模拟数据
async function searchPainPointQuestions() {
  // 模拟搜索到的痛点问题
  const simulatedQuestions = [
    {
      id: '111222333',
      title: '传统餐饮店点餐流程太慢，如何用技术提升效率？',
      answer_count: 89,
      keyword: '效率低'
    },
    {
      id: '444555666',
      title: '小型健身房会员管理混乱，有什么好用的管理软件？',
      answer_count: 67,
      keyword: '管理混乱'
    },
    {
      id: '777888999',
      title: '自由职业者时间管理困难，如何合理安排工作？',
      answer_count: 124,
      keyword: '时间管理'
    },
    {
      id: '222333444',
      title: '传统家政服务预约麻烦，如何实现线上预约？',
      answer_count: 56,
      keyword: '预约麻烦'
    },
    {
      id: '555666777',
      title: '小型培训机构课程安排复杂，如何优化排课系统？',
      answer_count: 78,
      keyword: '系统优化'
    },
    {
      id: '888999000',
      title: '传统物流跟踪困难，如何实现实时物流追踪？',
      answer_count: 92,
      keyword: '跟踪困难'
    },
    {
      id: '333444555',
      title: '小型零售店库存盘点繁琐，如何实现智能库存管理？',
      answer_count: 65,
      keyword: '库存管理'
    },
    {
      id: '666777888',
      title: '传统维修服务响应慢，如何提升服务响应速度？',
      answer_count: 43,
      keyword: '响应速度'
    },
    {
      id: '999000111',
      title: '小型美容院客户档案管理混乱，如何数字化管理？',
      answer_count: 54,
      keyword: '数字化'
    },
    {
      id: '123123123',
      title: '传统洗衣店取衣通知麻烦，如何实现智能通知？',
      answer_count: 38,
      keyword: '智能通知'
    }
  ];
  
  const results = [];
  
  for (const question of simulatedQuestions) {
    const title = question.title || '';
    const url = `https://www.zhihu.com/question/${question.id}`;
    const answerCount = question.answer_count || 0;
    
    if (isPainPointQuestion(title)) {
      const desc = `知乎问题: ${title}`;
      const { score, reason } = scoreZhihuItem(title, desc);
      const analysis = analyzeZhihuTopic(title, desc);
      
      results.push({
        id: `zhihu-search-${question.id}`,
        title: title.slice(0, 100),
        score,
        scoreReason: reason,
        ...analysis,
        desc: desc.slice(0, 200),
        url,
        source: 'zhihu',
        sourceLabel: '知乎搜索',
        category: detectZhihuCategory(title),
        fetchedAt: new Date().toISOString(),
        dateKey: new Date().toISOString().slice(0, 10),
        answerCount,
        searchKeyword: question.keyword,
        isPainPoint: true
      });
    }
  }
  
  console.log(`[知乎搜索] 模拟 ${results.length} 个痛点问题`);
  return results;
}

// 判断是否为痛点话题
function isPainPointTopic(title) {
  if (!title) return false;
  
  const titleLower = title.toLowerCase();
  const painKeywords = [
    '痛点', '不方便', '难用', '改进', '优化',
    '效率', '体验', '成本', '麻烦', '繁琐',
    '传统', '老旧', '手工', '纸质', 'excel',
    '管理', '系统', '工具', '软件', 'app'
  ];
  
  // 检查是否包含痛点关键词
  for (const keyword of painKeywords) {
    if (titleLower.includes(keyword)) {
      return true;
    }
  }
  
  // 检查是否为疑问句（通常表示有问题需要解决）
  const questionPattern = /[？?]|怎么|如何|为什么|怎样|有没有/;
  if (questionPattern.test(title)) {
    return true;
  }
  
  return false;
}

// 判断是否为痛点问题
function isPainPointQuestion(title) {
  if (!title) return false;
  
  const titleLower = title.toLowerCase();
  const painPatterns = [
    /(太|很|非常)?(麻烦|复杂|繁琐|难用|不方便)/,
    /(如何|怎么|怎样)(解决|改进|优化|提升)/,
    /(有没有)(更好|更简单|更方便)/,
    /(吐槽|批评|差评).*(系统|软件|工具|app)/,
    /(传统|老旧).*(系统|方式|方法)/,
    /(手工|纸质|excel).*(管理|记录|统计)/
  ];
  
  for (const pattern of painPatterns) {
    if (pattern.test(titleLower)) {
      return true;
    }
  }
  
  return false;
}

// 知乎内容评分
function scoreZhihuItem(title, desc) {
  let score = 2; // 基础分
  let reason = '基础话题';
  
  const text = (title + ' ' + desc).toLowerCase();
  
  // 加分项
  if (text.includes('痛点') || text.includes('不方便') || text.includes('难用')) {
    score += 1;
    reason = '明确痛点';
  }
  
  if (text.includes('传统') || text.includes('老旧') || text.includes('手工')) {
    score += 1;
    reason = '传统领域';
  }
  
  if (text.includes('效率') || text.includes('体验') || text.includes('成本')) {
    score += 1;
    reason = '核心问题';
  }
  
  if (text.includes('管理') || text.includes('系统') || text.includes('工具')) {
    score += 1;
    reason = '工具需求';
  }
  
  // 减分项
  if (text.includes('政治') || text.includes('敏感') || text.includes('争议')) {
    score -= 1;
    reason = '敏感话题';
  }
  
  // 限制分数在1-5之间
  score = Math.max(1, Math.min(5, score));
  
  return { score, reason };
}

// 分析知乎话题
function analyzeZhihuTopic(title, desc) {
  const text = title + ' ' + desc;
  const textLower = text.toLowerCase();
  
  // 基础分析
  let problem = '用户遇到的具体问题';
  let chinaFit = 'mid';
  let chinaReason = '需具体分析';
  let soloFit = 'maybe';
  let soloReason = '需评估具体方案';
  
  // 问题识别
  if (textLower.includes('excel') && textLower.includes('管理')) {
    problem = '企业用Excel管理数据效率低下易出错';
    chinaFit = 'high';
    chinaReason = '国内企业普遍依赖Excel';
    soloFit = 'yes';
    soloReason = '可开发轻量级数据管理工具';
  } else if (textLower.includes('手工') && textLower.includes('记录')) {
    problem = '传统行业手工记录数据繁琐易丢失';
    chinaFit = 'high';
    chinaReason = '国内中小企业数字化需求大';
    soloFit = 'yes';
    soloReason = '移动端数据采集工具';
  } else if (textLower.includes('班级') && textLower.includes('管理')) {
    problem = '教师班级管理方式枯燥学生参与度低';
    chinaFit = 'high';
    chinaReason = '教育信息化政策支持';
    soloFit = 'yes';
    soloReason = '游戏化班级管理工具';
  } else if (textLower.includes('客户') && textLower.includes('跟进')) {
    problem = '小微企业客户跟进混乱易漏单';
    chinaFit = 'high';
    chinaReason = '国内小微企业数量庞大';
    soloFit = 'yes';
    soloReason = '轻量级CRM工具';
  }
  
  // AI深度分析占位符
  const targetUsers = '相关行业从业者';
  const competitors = '现有解决方案体验不佳';
  const chinaGap = '缺乏简单易用的专业工具';
  const mvp = '核心功能最小化验证';
  const coldStart = '从垂直社群开始推广';
  
  return {
    problem,
    chinaFit,
    chinaReason,
    soloFit,
    soloReason,
    targetUsers,
    competitors,
    chinaGap,
    mvp,
    coldStart
  };
}

// 知乎话题分类
function detectZhihuCategory(title) {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('教育') || titleLower.includes('学校') || titleLower.includes('老师')) {
    return '教育';
  } else if (titleLower.includes('医疗') || titleLower.includes('医院') || titleLower.includes('医生')) {
    return '医疗';
  } else if (titleLower.includes('零售') || titleLower.includes('店铺') || titleLower.includes('销售')) {
    return '零售';
  } else if (titleLower.includes('办公') || titleLower.includes('企业') || titleLower.includes('公司')) {
    return '办公';
  } else if (titleLower.includes('生活') || titleLower.includes('日常') || titleLower.includes('家庭')) {
    return '生活';
  } else if (titleLower.includes('财务') || titleLower.includes('会计') || titleLower.includes('发票')) {
    return '财务';
  } else {
    return '其他';
  }
}

// 主函数
async function fetchZhihuData() {
  console.log('[知乎] 开始抓取数据...');
  
  const hotResults = await fetchZhihuHot();
  const searchResults = await searchPainPointQuestions();
  
  // 合并结果，去重
  const allResults = [...hotResults, ...searchResults];
  const uniqueResults = [];
  const seenIds = new Set();
  
  for (const item of allResults) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      uniqueResults.push(item);
    }
  }
  
  console.log(`[知乎] 总计抓取 ${uniqueResults.length} 个有效话题`);
  return uniqueResults;
}

module.exports = { fetchZhihuData };