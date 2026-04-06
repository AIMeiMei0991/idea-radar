/**
 * 共享 AI 分析模块
 * - preFilter: qwen-turbo 预筛（判断是否真实需求）
 * - analyzeWithQwen: qwen-plus 深度分析（输出完整 15 字段 JSON）
 */

const OpenAI = require('openai');

const QWEN_KEY = process.env.QWEN_API_KEY || 'sk-ea127923cf19456fb783bc11421fd255';

const qwen = new OpenAI({
  apiKey: QWEN_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * 预筛：判断帖子是否包含真实需求
 * @param {object} post - { title, body, comments }
 * @returns {Promise<boolean>}
 */
async function preFilter(post) {
  const commentBlock = post.comments?.length
    ? `\n\n评论区（${post.comments.length}条，按热度排序）:\n${post.comments.map((c, i) => `[${i + 1}] ${c}`).join('\n')}`
    : '';

  const prompt = `判断以下帖子是否包含一个真实的、具体的、未被很好解决的需求或痛点。

标题: ${post.title}
正文: ${(post.body || '').slice(0, 600)}${commentBlock}

判断标准：
- yes：作者描述了真实困境，说明了为什么现有工具不够用；或评论里多人表达同样的痛点
- no：只是泛泛的功能建议、已有成熟方案、纯讨论/闲聊、与商业机会无关

只回复 yes 或 no。`;

  try {
    const res = await qwen.chat.completions.create({
      model: 'qwen-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 5,
    });
    return res.choices[0].message.content.trim().toLowerCase().startsWith('yes');
  } catch {
    return false;
  }
}

/**
 * 深度分析：返回完整创业机会 JSON
 * @param {object} post - { platform, subreddit?, node?, title, body, comments, score, numComments }
 * @returns {Promise<object|null>}
 */
async function analyzeWithQwen(post) {
  const commentBlock = post.comments?.length
    ? `\n\n评论区反馈（最能反映需求真实程度）:\n${post.comments.map((c, i) => `[${i + 1}] ${c}`).join('\n')}`
    : '';

  const sourceTag = [
    post.platform,
    post.subreddit ? ` r/${post.subreddit}` : '',
    post.node ? ` [${post.node}]` : '',
  ].join('');

  const prompt = `你是"创意雷达"产品分析师。基于帖子的完整内容（标题+正文+评论）分析创业机会。
注意：分析必须忠于原文，不要编造或过度推断。

来源: ${sourceTag}
热度: ${post.score} 赞 · ${post.numComments} 评论
标题: ${post.title}
正文: ${(post.body || '（无正文）').slice(0, 1200)}${commentBlock}

只返回 JSON，不要任何额外文字：

{
  "title": "用中文提炼创业机会标题（20字以内，具体有吸引力）",
  "score": 1到5的整数（1=无商业价值，3=有潜力值得研究，5=强需求一人可做），
  "scoreReason": "一句话评分理由（结合评论共鸣程度）",
  "problem": "谁在痛？什么具体场景？为什么现有工具解决不了？（100字以内，基于原文，不编造）",
  "solution": "创新解法核心机制（80字以内）",
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
  "devTimeline": "1-3月 或 3-6月 或 6-12月",
  "techStack": ["技术1", "技术2", "技术3"],
  "painType": "效率 或 成本 或 体验 或 情感",
  "category": "AI工具或效率工具或金融工具或教育或健康或本地服务或开发者工具或其他"
}`;

  try {
    const res = await qwen.chat.completions.create({
      model: 'qwen-plus',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1300,
    });
    const content = res.choices[0].message.content;
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    console.error(`  ⚠️ 解析失败: ${e.message}`);
    return null;
  }
}

module.exports = { preFilter, analyzeWithQwen, sleep };
