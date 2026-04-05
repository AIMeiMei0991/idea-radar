// 小红书数据抓取模块
// 专注于发现生活消费领域的痛点需求

// 小红书模拟搜索（由于API限制，使用模拟请求）
async function searchXiaohongshu(keyword) {
  try {
    // 模拟搜索URL
    const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}`;
    
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!res.ok) {
      console.error(`[小红书搜索 ${keyword}] 请求失败: ${res.status}`);
      return [];
    }
    
    const html = await res.text();
    return parseXhsSearchResults(html, keyword);
    
  } catch (error) {
    console.error(`[小红书搜索 ${keyword}] 失败:`, error.message);
    return [];
  }
}

// 解析小红书搜索结果
function parseXhsSearchResults(html, keyword) {
  const results = [];
  
  try {
    // 尝试提取笔记信息（简化版，实际需要更复杂的解析）
    // 这里使用正则匹配笔记标题和描述
    const notePattern = /<div[^>]*class="[^"]*note-item[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    const titlePattern = /<div[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/div>/;
    const descPattern = /<div[^>]*class="[^"]*desc[^"]*"[^>]*>([^<]+)<\/div>/;
    const linkPattern = /href="(\/explore\/[^"]+)"/;
    
    let match;
    while ((match = notePattern.exec(html)) !== null && results.length < 10) {
      const noteHtml = match[1];
      
      const titleMatch = noteHtml.match(titlePattern);
      const descMatch = noteHtml.match(descPattern);
      const linkMatch = noteHtml.match(linkPattern);
      
      if (titleMatch && descMatch) {
        const title = titleMatch[1].trim();
        const desc = descMatch[1].trim();
        const relativeUrl = linkMatch ? linkMatch[1] : '';
        const url = relativeUrl ? `https://www.xiaohongshu.com${relativeUrl}` : '';
        
        // 过滤痛点相关的内容
        if (isXhsPainPoint(title, desc)) {
          const { score, reason } = scoreXhsItem(title, desc);
          const analysis = analyzeXhsContent(title, desc);
          
          results.push({
            id: `xhs-${Buffer.from(title + url).toString('base64').slice(0, 16)}`,
            title: title.slice(0, 80),
            score,
            scoreReason: reason,
            ...analysis,
            desc: desc.slice(0, 150),
            url,
            source: 'xiaohongshu',
            sourceLabel: '小红书',
            category: detectXhsCategory(title),
            fetchedAt: new Date().toISOString(),
            dateKey: new Date().toISOString().slice(0, 10),
            searchKeyword: keyword,
            isPainPoint: true
          });
        }
      }
    }
    
  } catch (error) {
    console.error('[小红书解析] 失败:', error.message);
  }
  
  return results;
}

// 搜索痛点相关的小红书内容
async function searchPainPointXhs() {
  const searchKeywords = [
    '生活痛点', '不方便', '太难用', '有没有更好的',
    '家居烦恼', '带娃难题', '工作麻烦', '学习效率',
    '收纳整理', '时间管理', '健康管理', '财务规划',
    '购物踩坑', '装修吐槽', '出行不便', '饮食困扰'
  ];
  
  const allResults = [];
  
  for (const keyword of searchKeywords.slice(0, 8)) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 避免请求过快
      
      console.log(`[小红书] 搜索关键词: ${keyword}`);
      const results = await searchXiaohongshu(keyword);
      
      if (results.length > 0) {
        allResults.push(...results);
        console.log(`[小红书 ${keyword}] 找到 ${results.length} 个痛点笔记`);
      }
      
    } catch (error) {
      console.error(`[小红书搜索 ${keyword}] 失败:`, error.message);
    }
  }
  
  // 去重
  const uniqueResults = [];
  const seenIds = new Set();
  
  for (const item of allResults) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      uniqueResults.push(item);
    }
  }
  
  console.log(`[小红书] 总计发现 ${uniqueResults.length} 个痛点笔记`);
  return uniqueResults;
}

// 判断是否为痛点内容
function isXhsPainPoint(title, desc) {
  if (!title && !desc) return false;
  
  const text = (title + ' ' + desc).toLowerCase();
  const painPatterns = [
    /(太|很|非常)?(麻烦|复杂|繁琐|难用|不方便|头疼)/,
    /(如何|怎么|怎样)(解决|改进|优化|处理)/,
    /(有没有)(更好|更简单|更方便|更便宜)/,
    /(吐槽|避坑|踩雷|差评).*(产品|工具|方法)/,
    /(生活|日常).*(难题|烦恼|困扰)/,
    /(带娃|育儿|家务|工作).*(累|烦|难)/
  ];
  
  // 检查是否包含痛点关键词
  const painKeywords = [
    '痛点', '不方便', '难用', '改进', '优化',
    '效率', '体验', '成本', '麻烦', '繁琐',
    '传统', '老旧', '手工', '纸质', '管理',
    '系统', '工具', 'app', '软件', '方法'
  ];
  
  for (const keyword of painKeywords) {
    if (text.includes(keyword)) {
      return true;
    }
  }
  
  // 检查是否匹配痛点模式
  for (const pattern of painPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

// 小红书内容评分
function scoreXhsItem(title, desc) {
  let score = 2; // 基础分
  let reason = '生活分享';
  
  const text = (title + ' ' + desc).toLowerCase();
  
  // 加分项
  if (text.includes('痛点') || text.includes('不方便') || text.includes('难用')) {
    score += 1;
    reason = '明确痛点';
  }
  
  if (text.includes('生活') || text.includes('日常') || text.includes('家居')) {
    score += 1;
    reason = '生活场景';
  }
  
  if (text.includes('效率') || text.includes('时间') || text.includes('管理')) {
    score += 1;
    reason = '效率需求';
  }
  
  if (text.includes('带娃') || text.includes('育儿') || text.includes('家庭')) {
    score += 1;
    reason = '家庭需求';
  }
  
  if (text.includes('工作') || text.includes('学习') || text.includes('办公')) {
    score += 1;
    reason = '工作学习';
  }
  
  // 减分项
  if (text.includes('广告') || text.includes('推广') || text.includes('营销')) {
    score -= 1;
    reason = '广告内容';
  }
  
  // 限制分数在1-5之间
  score = Math.max(1, Math.min(5, score));
  
  return { score, reason };
}

// 分析小红书内容
function analyzeXhsContent(title, desc) {
  const text = title + ' ' + desc;
  const textLower = text.toLowerCase();
  
  // 基础分析
  let problem = '用户遇到的生活或工作难题';
  let chinaFit = 'high'; // 小红书内容通常更贴近中国用户
  let chinaReason = '国内用户普遍需求';
  let soloFit = 'maybe';
  let soloReason = '需评估具体场景';
  
  // 问题识别
  if (textLower.includes('带娃') && textLower.includes('累')) {
    problem = '宝妈带娃过程繁琐疲惫缺乏帮手';
    chinaFit = 'high';
    chinaReason = '国内育儿压力大需求明确';
    soloFit = 'yes';
    soloReason = '可开发育儿辅助工具';
  } else if (textLower.includes('收纳') && textLower.includes('乱')) {
    problem = '家庭物品收纳混乱找不到东西';
    chinaFit = 'high';
    chinaReason = '国内居住空间有限收纳需求大';
    soloFit = 'yes';
    soloReason = '智能收纳管理工具';
  } else if (textLower.includes('时间') && textLower.includes('不够')) {
    problem = '上班族时间管理混乱效率低下';
    chinaFit = 'high';
    chinaReason = '国内工作压力大时间管理需求强';
    soloFit = 'yes';
    soloReason = '个性化时间管理应用';
  } else if (textLower.includes('健康') && textLower.includes('管理')) {
    problem = '年轻人健康意识强但缺乏系统管理';
    chinaFit = 'high';
    chinaReason = '国内健康消费升级趋势明显';
    soloFit = 'yes';
    soloReason = '轻量级健康管理工具';
  } else if (textLower.includes('购物') && textLower.includes('踩坑')) {
    problem = '消费者购物决策困难易买错商品';
    chinaFit = 'high';
    chinaReason = '国内电商发达选择过多';
    soloFit = 'yes';
    soloReason = '智能购物决策助手';
  } else if (textLower.includes('饮食') && textLower.includes('困扰')) {
    problem = '上班族饮食不规律营养不均衡';
    chinaFit = 'high';
    chinaReason = '国内外卖普及但健康问题突出';
    soloFit = 'yes';
    soloReason = '个性化饮食规划工具';
  }
  
  // 注意：不在此生成 targetUsers/competitors/chinaGap/mvp/coldStart
  // 这些字段由 Qwen 深度分析填充，规则生成的套话质量太低
  return { problem, chinaFit, chinaReason, soloFit, soloReason };
}

// 小红书内容分类
function detectXhsCategory(title) {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('带娃') || titleLower.includes('育儿') || titleLower.includes('宝宝')) {
    return '育儿';
  } else if (titleLower.includes('家居') || titleLower.includes('收纳') || titleLower.includes('装修')) {
    return '家居';
  } else if (titleLower.includes('工作') || titleLower.includes('办公') || titleLower.includes('职场')) {
    return '职场';
  } else if (titleLower.includes('学习') || titleLower.includes('考试') || titleLower.includes('教育')) {
    return '学习';
  } else if (titleLower.includes('健康') || titleLower.includes('健身') || titleLower.includes('饮食')) {
    return '健康';
  } else if (titleLower.includes('购物') || titleLower.includes('消费') || titleLower.includes('省钱')) {
    return '消费';
  } else if (titleLower.includes('旅行') || titleLower.includes('出行') || titleLower.includes('旅游')) {
    return '旅行';
  } else {
    return '生活';
  }
}

// 获取热门话题（模拟）
async function fetchXhsHotTopics() {
  // 模拟热门话题
  const hotTopics = [
    {
      title: '带娃的十大痛点，你中了几个？',
      desc: '分享带娃过程中遇到的各种难题和解决方法',
      category: '育儿'
    },
    {
      title: '上班族时间管理，真的有必要吗？',
      desc: '讨论如何高效管理时间提升工作效率',
      category: '职场'
    },
    {
      title: '家居收纳整理，从入门到放弃',
      desc: '分享收纳整理的经验和踩过的坑',
      category: '家居'
    },
    {
      title: '健康饮食，如何坚持？',
      desc: '探讨健康饮食的难点和坚持方法',
      category: '健康'
    },
    {
      title: '购物决策困难症，怎么破？',
      desc: '分享购物时如何做出正确决策',
      category: '消费'
    }
  ];
  
  const results = [];
  
  for (const topic of hotTopics) {
    const { score, reason } = scoreXhsItem(topic.title, topic.desc);
    const analysis = analyzeXhsContent(topic.title, topic.desc);
    
    results.push({
      id: `xhs-hot-${Buffer.from(topic.title).toString('base64').slice(0, 16)}`,
      title: topic.title,
      score,
      scoreReason: reason,
      ...analysis,
      desc: topic.desc,
      url: 'https://www.xiaohongshu.com',
      source: 'xiaohongshu',
      sourceLabel: '小红书热门',
      category: topic.category,
      fetchedAt: new Date().toISOString(),
      dateKey: new Date().toISOString().slice(0, 10),
      isHotTopic: true
    });
  }
  
  return results;
}

// 主函数
async function fetchXhsData() {
  console.log('[小红书] 开始抓取数据...');
  
  try {
    const hotResults = await fetchXhsHotTopics();
    const searchResults = await searchPainPointXhs();
    
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
    
    console.log(`[小红书] 总计抓取 ${uniqueResults.length} 个有效内容`);
    return uniqueResults;
    
  } catch (error) {
    console.error('[小红书] 抓取失败:', error.message);
    return [];
  }
}

module.exports = { fetchXhsData };