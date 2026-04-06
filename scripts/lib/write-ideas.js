/**
 * 共享写入模块
 * appendToIdeas: 质量过滤 + 去重 + 写入 ideas.json
 */

const fs   = require('fs');
const path = require('path');

const IDEAS_FILE = path.join(__dirname, '../../public/data/ideas.json');

/**
 * @param {object[]} newItems - 已经过 AI 分析的条目
 * @returns {number} 实际新增数量
 */
function appendToIdeas(newItems) {
  let existing = [];
  if (fs.existsSync(IDEAS_FILE)) {
    existing = JSON.parse(fs.readFileSync(IDEAS_FILE, 'utf-8'));
  }
  const existingUrls = new Set(existing.map(i => i.url));

  const toAdd = newItems.filter(i => {
    if (!i.url || existingUrls.has(i.url)) return false;       // 去重
    if (!i.problem || i.problem.trim().length < 10) return false; // 无痛点
    if (!i.title || i.title.trim().length < 5) return false;     // 无标题
    if (i.isPainPoint === false) return false;                    // 非痛点
    const s = Math.min(5, Math.max(1, Math.round(Number(i.score) || 1)));
    if (s < 3) return false;                                      // 低质量
    i.score = s;
    return true;
  });

  if (toAdd.length > 0) {
    fs.writeFileSync(IDEAS_FILE, JSON.stringify([...existing, ...toAdd], null, 2), 'utf-8');
  }
  return toAdd.length;
}

module.exports = { appendToIdeas, IDEAS_FILE };
