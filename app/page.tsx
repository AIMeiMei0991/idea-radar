"use client";

import { useEffect, useState, useCallback } from "react";

interface IdeaItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: "producthunt" | "trustmrr" | "indiehackers";
  sourceLabel: string;
  mrr?: string;
  votes?: number;
  tags: string[];
  fetchedAt: string;
  dateKey: string;
}

interface ApiResponse {
  grouped: Record<string, IdeaItem[]>;
  total: number;
  page: number;
  pageSize: number;
}

const SOURCE_CONFIG = {
  producthunt: { label: "Product Hunt", color: "bg-[#ff6154] text-white", dot: "bg-[#ff6154]" },
  trustmrr:    { label: "TrustMRR",    color: "bg-green-500 text-white", dot: "bg-green-500" },
  indiehackers:{ label: "IndieHackers",color: "bg-indigo-500 text-white", dot: "bg-indigo-500" },
};

function formatDate(dateKey: string) {
  const d = new Date(dateKey + "T00:00:00");
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(d);
}

function IdeaCard({ item }: { item: IdeaItem }) {
  const cfg = SOURCE_CONFIG[item.source] ?? { label: item.sourceLabel, color: "bg-gray-600 text-white", dot: "bg-gray-400" };
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 hover:bg-gray-850 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
              {cfg.label}
            </span>
            {item.mrr && (
              <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                {item.mrr}
              </span>
            )}
            {item.votes && (
              <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                ▲ {item.votes}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-100 text-sm leading-snug group-hover:text-white truncate">
            {item.title}
          </h3>
          {item.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.tags.map((tag) => (
                <span key={tag} className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-md">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-gray-600 group-hover:text-gray-400 text-sm mt-1 flex-shrink-0">→</span>
      </div>
    </a>
  );
}

function DateSection({ dateKey, items }: { dateKey: string; items: IdeaItem[] }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          {formatDate(dateKey)}
        </h2>
        <div className="flex-1 h-px bg-gray-800" />
        <span className="text-xs text-gray-600">{items.length} 条</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <IdeaCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [inputQ, setInputQ] = useState<string>("");
  const [page, setPage] = useState(1);
  const [triggering, setTriggering] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      if (q) params.set("q", q);
      params.set("page", String(page));
      const res = await fetch(`/api/ideas?${params}`);
      if (!res.ok) throw new Error("请求失败");
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError("加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [source, q, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQ(inputQ);
    setPage(1);
  };

  const triggerScrape = async () => {
    setTriggering(true);
    try {
      await fetch("/.netlify/functions/scrape-daily", { method: "POST" });
      setTimeout(() => { fetchData(); setTriggering(false); }, 3000);
    } catch {
      setTriggering(false);
    }
  };

  const sortedDates = Object.keys(data?.grouped ?? {}).sort((a, b) => b.localeCompare(a));
  const totalPages = Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 30));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Idea Radar
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              每天 08:00 自动抓取全球工具创意 · 按日期排序
            </p>
          </div>
          <button
            onClick={triggerScrape}
            disabled={triggering}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50 transition-colors border border-gray-700"
          >
            {triggering ? "抓取中..." : "立即抓取"}
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-4 flex-wrap">
          {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { setSource(source === key ? "" : key); setPage(1); }}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all
                ${source === key
                  ? "border-gray-500 bg-gray-800 text-white"
                  : "border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </button>
          ))}
          {source && (
            <button
              onClick={() => { setSource(""); setPage(1); }}
              className="text-xs text-gray-500 hover:text-gray-300 underline"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-8 flex gap-2">
        <input
          type="text"
          value={inputQ}
          onChange={(e) => setInputQ(e.target.value)}
          placeholder="搜索关键词，如：AI、视频、健康..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
        >
          搜索
        </button>
        {q && (
          <button
            type="button"
            onClick={() => { setQ(""); setInputQ(""); setPage(1); }}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg transition-colors"
          >
            清除
          </button>
        )}
      </form>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">加载中...</p>
          </div>
        </div>
      ) : error ? (
        <div className="text-center py-24">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <p className="text-gray-600 text-xs">
            如果是第一次部署，请点击「立即抓取」按钮初始化数据
          </p>
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-gray-500 text-sm mb-1">暂无数据</p>
          <p className="text-gray-600 text-xs">点击右上角「立即抓取」按钮初始化</p>
        </div>
      ) : (
        <>
          <div className="text-xs text-gray-600 mb-6">
            共 {data?.total} 条 {q && `· 关键词「${q}」`}
          </div>
          {sortedDates.map((dateKey) => (
            <DateSection key={dateKey} dateKey={dateKey} items={data!.grouped[dateKey]} />
          ))}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 transition-colors"
              >
                上一页
              </button>
              <span className="text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 transition-colors"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-gray-800 text-center">
        <p className="text-xs text-gray-700">
          数据来源：Product Hunt · TrustMRR · IndieHackers · 每天 08:00 CST 自动更新
        </p>
      </div>
    </div>
  );
}
