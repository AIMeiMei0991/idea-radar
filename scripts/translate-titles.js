// 批量翻译英文标题 → titleZh
// 每批 20 条，减少 API 调用次数
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../public/data/ideas.json');
const ENGLISH_SOURCES = ['producthunt', 'trustmrr', 'reddit', 'hackernews'];
const BATCH_SIZE = 20;

async function callQwen(prompt) {
  const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'qwen-turbo', // 翻译用 turbo 够了，省钱
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function translateBatch(titles) {
  const numbered = titles.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const prompt = `将以下英文产品/文章标题翻译成中文，要求：
- 简洁准确，保留产品名不翻译（如 Notion/Figma/Supabase 等）
- 数字/金额直接保留（如 $700/65K）
- 每行一个翻译，只输出翻译结果，不加序号和解释
- 如果标题已是中文则原样返回

${numbered}`;

  const result = await callQwen(prompt);
  const lines = result.trim().split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
  return lines;
}

(async () => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const need = data.filter(i => ENGLISH_SOURCES.includes(i.source) && !i.titleZh);
  console.log(`待翻译: ${need.length} 条，共 ${Math.ceil(need.length / BATCH_SIZE)} 批`);

  let done = 0, fail = 0;
  for (let i = 0; i < need.length; i += BATCH_SIZE) {
    const batch = need.slice(i, i + BATCH_SIZE);
    const titles = batch.map(item => item.title);
    try {
      const translated = await translateBatch(titles);
      batch.forEach((item, idx) => {
        if (translated[idx] && translated[idx].length > 0) {
          item.titleZh = translated[idx].slice(0, 80);
          done++;
        } else {
          fail++;
        }
      });
      process.stdout.write(`[${i + batch.length}/${need.length}] `);
    } catch (e) {
      console.error(`\n批次失败: ${e.message}`);
      fail += batch.length;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n完成: ${done} 成功, ${fail} 失败`);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log('已保存 ideas.json');
})();
