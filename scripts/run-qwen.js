// 单独跑 Qwen 分析，不重新抓取数据
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../public/data/ideas.json');

const BANNED_PHRASES = [
  '微信支付/小程序接入', '即刻独立开发者话题', '垂直社群', '行业协会微信群',
  '在 Behance/站酷', '电商运营类微信群', '缺乏简单易用的专业工具',
  '符合中国用户习惯的交互设计是核心壁垒', '本土化轻量工具严重缺位',
  '发布在少数派/即刻/独立开发者社群，前 100 用户靠口碑传播',
  '写 1-2 篇垂直内容（SEO 博客/抖音），吸引精准用户自然流入',
  '上线当天发独立开发者群/产品猎人，前 100 名免费换口碑',
];

function isValidQwenOutput(json) {
  if (!json || !json.problem || !json.mvp || !json.coldStart) return false;
  const text = JSON.stringify(json);
  if (BANNED_PHRASES.some(p => text.includes(p))) return false;
  if ((json.coldStart || '').replace(/\s/g, '').length < 4) return false;
  if ((json.mvp || '').replace(/\s/g, '').length < 8) return false;
  return true;
}

function buildPrompt(title, desc, mrr) {
  return `你是一人创业分析师，分析以下产品在中国的复制机会。必须针对这个具体产品，禁止套话。

产品名：${title}
描述：${desc || '见产品名'}${mrr ? `\n月收入验证：${mrr}` : ''}

字段要求（每条必须包含产品相关的具体词汇）：
- problem：这个产品的用户在哪个操作卡住了，必须提到具体场景动作（≤30字）
- solution：核心技术方案，提到具体技术或工程方式（≤30字）
- chinaFit：high或medium或low
- chinaReason：中国复制可行性说明（≤25字）
- soloFit：yes或maybe或no
- soloReason：一人开发可行性（≤25字）
- techStack：JSON数组，2-4个具体技术名
- devTimeline：1-3月/3-6月/6-12月 三选一
- resourceNeeds：JSON数组，1-3个具体资源
- painType：效率/体验/成本/情感 四选一
- targetUsers：描述2-3类具体用户角色（≤30字）
- competitors：列出2-3个竞品名称，说明各自弱点（≤40字）
- chinaGap：指出一个竞品缺失的具体功能或场景（≤30字）
- mvp：第一个能收到钱的最小功能，必须具体到界面或流程（≤30字）
- coldStart：第一个获客渠道的具体名称，例如"少数派Matrix专栏"或"V2EX程序员节点"或"36氪DEMO DAY"（≤20字，禁止写"垂直社群"）

只返回 JSON，不要 markdown 代码块：
{"problem":"...","solution":"...","chinaFit":"...","chinaReason":"...","soloFit":"...","soloReason":"...","techStack":[...],"devTimeline":"...","resourceNeeds":[...],"painType":"...","targetUsers":"...","competitors":"...","chinaGap":"...","mvp":"...","coldStart":"..."}`;
}

async function callQwen(prompt) {
  const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) { console.error('[Qwen] HTTP', res.status); return null; }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const match = text.replace(/```(?:json)?/gi, '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

(async () => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const need = data.filter(i => !i.aiAnalyzed && (i.score || 0) >= 3).slice(0, 100);
  console.log(`待分析: ${need.length} 条 (score≥3 未分析)`);

  let done = 0, fail = 0;
  for (const item of need) {
    try {
      let json = await callQwen(buildPrompt(item.title, item.desc || '', item.mrr));
      if (json && !isValidQwenOutput(json)) {
        // 重试一次
        await new Promise(r => setTimeout(r, 800));
        json = await callQwen(buildPrompt(item.title, item.desc || '', item.mrr)
          + '\n\n【重要】上次输出含套话，coldStart 必须是具体平台名，不得写"垂直社群"。');
      }
      if (json && json.problem) {
        Object.assign(item, json);
        item.aiAnalyzed = true;
        done++;
        process.stdout.write('.');
      } else {
        fail++;
        process.stdout.write('x');
      }
    } catch (e) {
      fail++;
      process.stdout.write('!');
    }
    await new Promise(r => setTimeout(r, 600));
  }

  const aiTotal = data.filter(i => i.aiAnalyzed).length;
  console.log(`\n完成: ${done} 成功, ${fail} 失败`);
  console.log(`总 aiAnalyzed: ${aiTotal} / ${data.length} (${Math.round(aiTotal / data.length * 100)}%)`);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log('已保存 ideas.json');
})();
