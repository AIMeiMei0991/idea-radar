// 测试新的数据抓取和分析系统
const { fetchZhihuData } = require('./zhihu-scraper');
const { fetchXhsData } = require('./xhs-scraper');

async function testScrapers() {
  console.log('=== 测试中文数据源抓取 ===\n');
  
  try {
    // 测试知乎抓取
    console.log('1. 测试知乎数据抓取...');
    const zhihuData = await fetchZhihuData();
    console.log(`   抓取到 ${zhihuData.length} 条知乎数据`);
    
    if (zhihuData.length > 0) {
      console.log('   示例数据:');
      const sample = zhihuData[0];
      console.log(`   - 标题: ${sample.title}`);
      console.log(`   - 痛点: ${sample.problem}`);
      console.log(`   - 评分: ${sample.score} (${sample.scoreReason})`);
      console.log(`   - 中国市场: ${sample.chinaFit} - ${sample.chinaReason}`);
      console.log(`   - 一人公司: ${sample.soloFit} - ${sample.soloReason}`);
    }
    
    console.log('\n2. 测试小红书数据抓取...');
    const xhsData = await fetchXhsData();
    console.log(`   抓取到 ${xhsData.length} 条小红书数据`);
    
    if (xhsData.length > 0) {
      console.log('   示例数据:');
      const sample = xhsData[0];
      console.log(`   - 标题: ${sample.title}`);
      console.log(`   - 痛点: ${sample.problem}`);
      console.log(`   - 评分: ${sample.score} (${sample.scoreReason})`);
      console.log(`   - 中国市场: ${sample.chinaFit} - ${sample.chinaReason}`);
      console.log(`   - 一人公司: ${sample.soloFit} - ${sample.soloReason}`);
    }
    
    // 分析数据质量
    console.log('\n=== 数据质量分析 ===');
    
    const allData = [...zhihuData, ...xhsData];
    console.log(`总计数据: ${allData.length} 条`);
    
    // 按来源统计
    const sourceStats = {};
    allData.forEach(item => {
      sourceStats[item.source] = (sourceStats[item.source] || 0) + 1;
    });
    console.log('按来源统计:');
    Object.entries(sourceStats).forEach(([source, count]) => {
      console.log(`   ${source}: ${count} 条`);
    });
    
    // 按评分统计
    const scoreStats = { '1分': 0, '2分': 0, '3分': 0, '4分': 0, '5分': 0 };
    allData.forEach(item => {
      const scoreKey = `${item.score}分`;
      if (scoreStats[scoreKey] !== undefined) {
        scoreStats[scoreKey]++;
      }
    });
    console.log('按评分统计:');
    Object.entries(scoreStats).forEach(([score, count]) => {
      console.log(`   ${score}: ${count} 条`);
    });
    
    // 按中国市场适配性统计
    const chinaFitStats = { high: 0, mid: 0, low: 0 };
    allData.forEach(item => {
      if (chinaFitStats[item.chinaFit] !== undefined) {
        chinaFitStats[item.chinaFit]++;
      }
    });
    console.log('按中国市场适配性统计:');
    Object.entries(chinaFitStats).forEach(([fit, count]) => {
      console.log(`   ${fit}: ${count} 条`);
    });
    
    // 按一人公司可行性统计
    const soloFitStats = { yes: 0, maybe: 0, hard: 0 };
    allData.forEach(item => {
      if (soloFitStats[item.soloFit] !== undefined) {
        soloFitStats[item.soloFit]++;
      }
    });
    console.log('按一人公司可行性统计:');
    Object.entries(soloFitStats).forEach(([fit, count]) => {
      console.log(`   ${fit}: ${count} 条`);
    });
    
    // 痛点类型分析
    console.log('\n=== 痛点类型分析 ===');
    const painTypes = {
      '效率痛点': 0,
      '体验痛点': 0,
      '成本痛点': 0,
      '情感痛点': 0,
      '其他痛点': 0
    };
    
    allData.forEach(item => {
      const problem = item.problem.toLowerCase();
      if (problem.includes('效率') || problem.includes('耗时') || problem.includes('繁琐')) {
        painTypes['效率痛点']++;
      } else if (problem.includes('体验') || problem.includes('难用') || problem.includes('复杂')) {
        painTypes['体验痛点']++;
      } else if (problem.includes('成本') || problem.includes('价格') || problem.includes('贵')) {
        painTypes['成本痛点']++;
      } else if (problem.includes('无聊') || problem.includes('枯燥') || problem.includes('成就感')) {
        painTypes['情感痛点']++;
      } else {
        painTypes['其他痛点']++;
      }
    });
    
    Object.entries(painTypes).forEach(([type, count]) => {
      if (count > 0) {
        const percentage = ((count / allData.length) * 100).toFixed(1);
        console.log(`   ${type}: ${count} 条 (${percentage}%)`);
      }
    });
    
    console.log('\n=== 测试完成 ===');
    console.log('总结:');
    console.log(`1. 成功抓取 ${allData.length} 条中文数据`);
    console.log(`2. 高价值数据 (4-5分): ${scoreStats['4分'] + scoreStats['5分']} 条`);
    console.log(`3. 高中国市场适配: ${chinaFitStats.high} 条`);
    console.log(`4. 一人公司可行: ${soloFitStats.yes} 条`);
    
    return allData;
    
  } catch (error) {
    console.error('测试失败:', error);
    return [];
  }
}

// 运行测试
if (require.main === module) {
  testScrapers().then(() => {
    console.log('\n测试脚本执行完毕');
    process.exit(0);
  }).catch(error => {
    console.error('测试脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { testScrapers };