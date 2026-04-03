"use client";

import { useEffect, useState, useCallback } from "react";

interface IdeaItem {
  id: string;
  title: string;
  titleZh: string;
  summary: string;
  opportunity: string;
  score: number;
  scoreReason: string;
  url: string;
  source: "producthunt" | "trustmrr" | "indiehackers";
  sourceLabel: string;
  mrr?: string;
  tags: string[];
  category: string;
  fetchedAt: string;
  dateKey: string;
}

interface ApiResponse {
  grouped: Record<string, IdeaItem[]>;
  total: number;
  page: number;
  pageSize: number;
}

const SCORE_CONFIG = [
  { label: "🔥🔥🔥", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30" },
  { label: "🔥🔥🔥", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30" },
  { label: "⭐⭐⭐", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" },
  { label: "⭐⭐", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  { label: "⭐", color: "text-gray-500", bg: "bg-gray-800/50 border-gray-700/30" },
];

const SOURCE_DOT: Record<string, string> = {
  producthunt: "bg-[#ff6154]",
  trustmrr: "bg-green-500",
  indiehackers: "bg-indigo-400",
};

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= score ? "bg-orange-400" : "bg-gray-700"}`}
        />
      ))}
    </div>
  );
}

function IdeaCard({ item }: { item: IdeaItem }) {
  const scoreIdx = Math.max(0, 5 - item.score);
  const cfg = SCORE_CONFIG[scoreIdx] ?? SCORE_CONFIG[4];
  const dot = SOURCE_DOT[item.source] ?? "bg-gray-500";

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-2xl border p-4 active:scale-[0.98] transition-transform ${cfg.bg}`}
    >
      {/* 顶部：来源 + 评分 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
          <span className="text-xs text-gray-500">{item.sourceLabel}</span>
          {item.category && (
            <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-md">{item.category}</span>
          )}
        </div>
        <ScoreDots score={item.score} />
      </div>

      {/* 标题 */}
      <h3 className="font-semibold text-white text-[15px] leading-snug mb-1">
        {item.title}
      </h3>

      {/* MRR 标签 */}
      {item.mrr && (
        <div className="inline-flex items-center gap-1 bg-green-500/15 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full mb-2">
          <span>💰</span> {item.mrr}
        </div>
      )}

      {/* 核心论点 */}
      <p className="text-sm text-gray-300 leading-relaxed mb-2">
        {item.summary}
      </p>

      {/* 中国市场机会 */}
      {item.opportunity && (
        <div className="flex items-start gap-1.5 bg-blue-500/10 rounded-xl px-3 py-2">
          <span className="text-blue-400 text-xs mt-0.5 flex-shrink-0">🇨🇳</span>
          <p className="text-xs text-blue-300 leading-relaxed">{item.opportunity}</p>
        </div>
      )}

      {/* 评分理由 */}
      {item.scoreReason && (
        <p className="text-xs text-gray-600 mt-2">{item.scoreReason}</p>
      )}
    </a>
  );
}

function DateSection({ dateKey, items }: { dateKey: string; items: IdeaItem[] }) {
  const d = new Date(dateKey + "T12:00:00");
  const label = new Intl.DateTimeFormat("zh-CN", {
    month: "long", day: "numeric", weekday: "short",
  }).format(d);

  // 按评分排序
  const sorted = [...items].sort((a, b) => b.score - a.score);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 px-4 mb-3 sticky top-12 z-10 py-2 bg-gray-950/90 backdrop-blur-sm">
        <span className="text-sm font-semibold text-gray-300">{label}</span>
        <span className="text-xs text-gray-600">· {items.length} 条</span>
      </div>
      <div className="px-4 flex flex-col gap-3">
        {sorted.map((item) => (
          <IdeaCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

const FILTERS = [
  { key: "", label: "全部" },
  { key: "producthunt", label: "PH 新品" },
  { key: "trustmrr", label: "验证收入" },
  { key: "indiehackers", label: "独立创业" },
];

const SCORE_FILTERS = [
  { key: 0, label: "全部" },
  { key: 4, label: "🔥 高价值" },
  { key: 3, label: "⭐ 潜力" },
];

export default function Page() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [q, setQ] = useState("");
  const [inputQ, setInputQ] = useState("");
  const [page, setPage] = useState(1);
  const [scraping, setScraping] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      if (q) params.set("q", q);
      if (minScore > 0) params.set("minScore", String(minScore));
      params.set("page", String(page));
      const res = await fetch(`/api/ideas?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [source, q, minScore, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQ(inputQ);
    setPage(1);
  };

  const triggerScrape = async () => {
    setScraping(true);
    try {
      await fetch("/.netlify/functions/scrape-daily", { method: "POST" });
      setTimeout(() => { fetchData(); setScraping(false); }, 4000);
    } catch { setScraping(false); }
  };

  const sortedDates = Object.keys(data?.grouped ?? {}).sort((a, b) => b.localeCompare(a));
  const totalPages = Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 30));

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-950">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-20 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800/50">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white">创意雷达</span>
            <span className="text-xs text-gray-600">每日更新</span>
          </div>
          <button
            onClick={triggerScrape}
            disabled={scraping}
            className="text-xs px-3 py-1.5 rounded-full bg-gray-800 text-gray-400 active:bg-gray-700 disabled:opacity-40"
          >
            {scraping ? "抓取中…" : "立即刷新"}
          </button>
        </div>

        {/* 搜索框 */}
        <form onSubmit={handleSearch} className="px-4 pb-2">
          <div className="flex gap-2">
            <input
              type="search"
              value={inputQ}
              onChange={(e) => setInputQ(e.target.value)}
              placeholder="搜索，如：AI视频、小红书…"
              className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600 h-9"
            />
            {q && (
              <button
                type="button"
                onClick={() => { setQ(""); setInputQ(""); setPage(1); }}
                className="px-3 py-1 bg-gray-800 text-gray-400 rounded-xl text-sm h-9"
              >
                清除
              </button>
            )}
          </div>
        </form>

        {/* 来源筛选 */}
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { setSource(f.key); setPage(1); }}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
                source === f.key
                  ? "bg-white text-gray-900 font-semibold"
                  : "bg-gray-800 text-gray-400"
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="w-px bg-gray-800 flex-shrink-0" />
          {SCORE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { setMinScore(f.key); setPage(1); }}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
                minScore === f.key
                  ? "bg-white text-gray-900 font-semibold"
                  : "bg-gray-800 text-gray-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="pt-2 pb-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <div className="w-7 h-7 border-2 border-gray-700 border-t-orange-400 rounded-full animate-spin" />
            <p className="text-gray-600 text-sm">加载中…</p>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-2 px-8 text-center">
            <p className="text-2xl">📡</p>
            <p className="text-gray-400 text-sm font-medium">暂无数据</p>
            <p className="text-gray-600 text-xs">点击右上角「立即刷新」初始化数据</p>
          </div>
        ) : (
          <>
            {/* 统计 */}
            <div className="flex items-center gap-2 px-4 py-2 mb-1">
              <p className="text-xs text-gray-600">
                共 <span className="text-gray-400 font-medium">{data?.total}</span> 条
                {q && <span> · 搜索「{q}」</span>}
              </p>
            </div>

            {sortedDates.map((dateKey) => (
              <DateSection key={dateKey} dateKey={dateKey} items={data!.grouped[dateKey]} />
            ))}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 px-4 py-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-5 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm disabled:opacity-30"
                >
                  上一页
                </button>
                <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-5 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm disabled:opacity-30"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部说明 */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-4 py-3 bg-gray-950/90 backdrop-blur-sm border-t border-gray-800/50">
        <p className="text-center text-xs text-gray-700">
          Product Hunt · TrustMRR · IndieHackers · 每天 08:00 自动更新
        </p>
      </div>
    </div>
  );
}
