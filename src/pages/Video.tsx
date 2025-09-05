// src/pages/video.tsx
import React, { useMemo, useState } from "react";
import { Youtube, ExternalLink, Search, Play } from "lucide-react";

/** Simple descriptor for a YouTube video */
type YtVideo = {
  id: string; // YouTube video ID (the part after v= or /embed/)
  title: string;
};

/** Featured "About" video */
const FEATURED: YtVideo = {
  id: "t7anNn4NMAE",
  title:
    "Nakoda Mobile पर किया किया मिलता है | Online Buy Professional Mobile Repairing Tool",
};

/**
 * Demo list with 10 entries. Replace any IDs/titles with your real YouTube videos.
 * Tip: Video ID is the part after `v=` in a standard YouTube URL.
 */
const VIDEOS: YtVideo[] = [
  FEATURED,
  { id: "YhUGj7myA0c", title: "Best Mobile Accessories 2024 — Buyer’s Guide" },
  { id: "3ymRTT4nC3k", title: "How to Choose TWS Earbuds (Explained Simply)" },
  { id: "EgzqfumG0lg", title: "Fast Charging Myths & Truths — Must Watch!" },
  { id: "Wj9E-c8Riko", title: "Top 10 Budget Neckbands — Value Picks" },
  { id: "RHFCB7YFVro", title: "OEM Branding Walkthrough — Step by Step" },
  { id: "VlOw5F0pvKg", title: "Mobile Repair Tools — Pro Tips for Beginners" },
  { id: "3-vt8yyTLKQ", title: "Type-C Cables: What Matters? (Speed & Safety)" },
  { id: "Sooju3_mQVY", title: "Shop Tour — Inside Nakoda Mobile" },
  { id: "WBr9WwEBuLg", title: "Power Adapters 101 — Which One to Buy?" },
];

const YT_PARAMS = "rel=0&modestbranding=1&playsinline=1&color=white";
const embedUrl = (id: string) =>
  `https://www.youtube.com/embed/${id}?${YT_PARAMS}`;
const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const thumbUrlWebp = (id: string) =>
  `https://i.ytimg.com/vi_webp/${id}/hqdefault.webp`;
const thumbUrlJpg = (id: string) =>
  `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** Responsive 16:9 YouTube iframe wrapper */
const ResponsiveIframe: React.FC<{ title: string; src: string }> = ({
  title,
  src,
}) => (
  <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-white">
    <div className="pt-[56.25%]" />
    <iframe
      className="absolute inset-0 h-full w-full"
      src={src}
      title={title}
      frameBorder={0}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      loading="lazy"
    />
  </div>
);

/**
 * Lightweight player for the grid:
 * shows a thumbnail; converts to iframe when clicked/Enter-pressed.
 */
const ThumbPlayer: React.FC<{ video: YtVideo }> = ({ video }) => {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return <ResponsiveIframe title={video.title} src={embedUrl(video.id)} />;
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setPlaying(true);
        }
      }}
      className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-white group focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label={`Play video: ${video.title}`}
    >
      <div className="pt-[56.25%]" />
      <picture>
        <source srcSet={thumbUrlWebp(video.id)} type="image/webp" />
        <img
          src={thumbUrlJpg(video.id)}
          alt={video.title}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      </picture>

      {/* Play overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow-sm group-hover:scale-105 transition-transform">
          <Play className="h-4 w-4 text-red-600" />
          <span className="text-sm font-semibold text-gray-800">Play</span>
        </div>
      </div>
      <span className="sr-only">Play</span>
    </button>
  );
};

const VideoCard: React.FC<{ video: YtVideo }> = ({ video }) => (
  <article className="group flex flex-col gap-3">
    <ThumbPlayer video={video} />
    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
      {video.title}
    </h3>
    <div className="flex items-center gap-2">
      <a
        href={watchUrl(video.id)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <Youtube className="h-4 w-4 text-red-600" />
        Watch on YouTube
        <ExternalLink className="h-3.5 w-3.5 opacity-70" />
      </a>
    </div>
  </article>
);

const VideosPage: React.FC = () => {
  const [query, setQuery] = useState("");

  // de-dupe in case FEATURED is also included in VIDEOS
  const all = useMemo(() => {
    const map = new Map<string, YtVideo>();
    [FEATURED, ...VIDEOS].forEach((v) => map.set(v.id, v));
    return Array.from(map.values());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((v) => v.title.toLowerCase().includes(q));
  }, [all, query]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Nakoda Mobile — Videos
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Learn about our products, OEM services and professional mobile
          repairing tools.
        </p>
      </div>

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <ResponsiveIframe title={FEATURED.title} src={embedUrl(FEATURED.id)} />
          </div>
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                <Youtube className="h-4 w-4" />
                Featured
              </div>
              <h2 className="mt-3 text-lg font-semibold text-gray-900">
                About Nakoda Mobile
              </h2>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {FEATURED.title}
              </p>

              <a
                href={watchUrl(FEATURED.id)}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink className="h-4 w-4" />
                Open on YouTube
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* All videos + search */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-900">
            All Videos ({filtered.length})
          </h2>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search videos…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              inputMode="search"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600">
            No videos matched your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default VideosPage;
