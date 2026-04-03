# 部署指南

## 一键部署到 Netlify

### 步骤 1：安装依赖
```bash
cd idea-radar
npm install
```

### 步骤 2：本地测试
```bash
npm run dev
```
打开 http://localhost:3000

### 步骤 3：推送到 GitHub
```bash
git init
git add .
git commit -m "init idea radar"
git remote add origin <你的GitHub仓库地址>
git push -u origin main
```

### 步骤 4：连接 Netlify
1. 登录 https://netlify.com
2. "Add new site" → "Import an existing project"
3. 连接你的 GitHub 仓库
4. Build settings 自动识别（已配置 netlify.toml）
5. 点击 Deploy

### 步骤 5：启用 Netlify Blobs（自动）
Netlify 会自动启用 Blobs 存储，无需额外配置。

### 步骤 6：初始化数据
部署完成后，进入 Netlify Dashboard → Functions → scrape-daily，手动触发一次；
或者直接访问你的网站，点击右上角「立即抓取」按钮。

---

## 定时任务
已在 `netlify.toml` 配置每天 00:00 UTC（北京时间 08:00）自动运行。

## 数据源
- **Product Hunt** — 每日新产品 RSS
- **TrustMRR** — 已验证 MRR 的真实产品
- **IndieHackers** — 独立开发者产品

## 扩展：添加更多数据源
编辑 `netlify/functions/scrape-daily.mts`，在文件末尾添加新的 fetch 函数，
然后在 `handler` 中合并结果即可。
