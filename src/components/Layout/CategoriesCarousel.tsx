// src/components/CategoriesCarousel.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaOptionsType } from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight, Tags, Sparkles } from 'lucide-react';
import type { CategoryItem, Subcategory } from './CategoriesCinematic';

type Props = {
  items: CategoryItem[];
  onSelectCategory?: (cat: CategoryItem) => void;
  onSelectSubcategory?: (cat: CategoryItem, sub: Subcategory) => void;
  title?: string;
  subtitle?: string;
  /** Embla options override if you want to tweak */
  options?: EmblaOptionsType;
  /** ms for autoplay delay (matches plugin). Default 4000 */
  autoplayDelay?: number;
  /** Custom gradient accents to cycle if item.accent missing */
  accentPalette?: string[];
  /** Show total counts “x items” on card chip */
  showCounts?: boolean;
};

const DEFAULT_ACCENTS = [
  'from-blue-600 to-purple-600',
  'from-rose-600 to-orange-500',
  'from-emerald-600 to-teal-600',
  'from-indigo-600 to-cyan-600',
  'from-fuchsia-600 to-pink-600',
];

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

const CategoriesCarousel: React.FC<Props> = ({
  items,
  onSelectCategory,
  onSelectSubcategory,
  title = 'Featured Categories',
  subtitle = 'Quickly browse by category and popular brands',
  options,
  autoplayDelay = 4000,
  accentPalette = DEFAULT_ACCENTS,
  showCounts = true,
}) => {
  // Autoplay plugin (kept on a ref so it doesn’t reinit)
  const autoplayRef = useRef(
    Autoplay({ delay: autoplayDelay, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  const [viewportRef, embla] = useEmblaCarousel(
    {
      loop: true,
      align: 'start',
      dragFree: true,
      skipSnaps: false,
      ...options,
    },
    [autoplayRef.current]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  // Autoplay progress bar (0..100)
  const [progress, setProgress] = useState(0);
  const progressTimer = useRef<number | null>(null);
  const isHover = useRef(false);

  // Update selected slide
  const onSelect = useCallback(() => {
    if (!embla) return;
    setSelectedIndex(embla.selectedScrollSnap());
    // Reset progress each time slide changes
    setProgress(0);
  }, [embla]);

  // Setup listeners
  useEffect(() => {
    if (!embla) return;
    setSnapCount(embla.scrollSnapList().length);
    embla.on('select', onSelect);
    embla.on('reInit', () => {
      setSnapCount(embla.scrollSnapList().length);
      onSelect();
    });
    onSelect();
  }, [embla, onSelect]);

  // Handle autoplay progress animation
  useEffect(() => {
    if (!embla) return;

    const step = 20; // ms
    const tick = () => {
      // Pause “progress” while hovered
      if (isHover.current) return;
      setProgress((p) => {
        const next = p + (step / autoplayDelay) * 100;
        return clamp(next);
      });
    };

    if (progressTimer.current) window.clearInterval(progressTimer.current);
    progressTimer.current = window.setInterval(tick, step) as unknown as number;

    return () => {
      if (progressTimer.current) window.clearInterval(progressTimer.current);
    };
  }, [embla, autoplayDelay]);

  const onMouseEnter = () => {
    isHover.current = true;
  };
  const onMouseLeave = () => {
    isHover.current = false;
  };

  // Keyboard navigation for accessibility
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!embla) return;
    if (e.key === 'ArrowLeft') embla.scrollPrev();
    if (e.key === 'ArrowRight') embla.scrollNext();
  };

  const scrollPrev = useCallback(() => embla && embla.scrollPrev(), [embla]);
  const scrollNext = useCallback(() => embla && embla.scrollNext(), [embla]);
  const scrollTo = useCallback((i: number) => embla && embla.scrollTo(i), [embla]);

  // Count helper (uses description like "12 products" if present)
  const countOf = useCallback((c: CategoryItem) => {
    const m = (c.description || '').match(/^(\d+)/);
    return m ? Number(m[1]) : c.subcategories?.reduce((s, sc) => s + (sc.productCount || 0), 0) || 0;
  }, []);

  const slides = useMemo(
    () =>
      items.map((cat, i) => ({
        cat,
        total: countOf(cat),
        topSub: (cat.subcategories || []).slice(0, 4),
        accent: cat.accent || accentPalette[i % accentPalette.length],
      })),
    [items, countOf, accentPalette]
  );

  // Shimmer placeholders if no items
  if (!items || items.length === 0) {
    return (
      <section className="py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-blue-600" />
              {title}
            </h2>
            <p className="text-gray-600">{subtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm"
              >
                <div className="h-40 w-full bg-gray-100 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-2/3 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10" aria-label="Category carousel">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-blue-600 to-purple-600 p-1">
                <span className="rounded bg-white px-1.5 py-0.5 text-blue-700">★</span>
              </span>
              <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                {title}
              </span>
            </h2>
            <p className="text-gray-600">{subtitle}</p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={scrollPrev}
              className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={scrollNext}
              className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Carousel */}
        <div
          className="embla group"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onKeyDown={handleKey}
          tabIndex={0}
        >
          {/* Progress bar */}
          <div className="mb-3 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="embla__viewport" ref={viewportRef}>
            <div className="embla__container flex gap-4">
              {slides.map(({ cat, total, topSub, accent }, idx) => {
                const active = idx === selectedIndex;
                return (
                  <div
                    key={cat.id}
                    className="
                      embla__slide
                      flex-[0_0_85%]
                      sm:flex-[0_0_55%]
                      md:flex-[0_0_40%]
                      lg:flex-[0_0_30%]
                      xl:flex-[0_0_25%]
                    "
                    aria-roledescription="slide"
                    aria-label={`${idx + 1} of ${slides.length}`}
                  >
                    <article
                      className={`
                        relative h-full overflow-hidden rounded-2xl border bg-white shadow-sm transition-all
                        ${active ? 'border-transparent shadow-lg' : 'border-gray-200 hover:shadow-md'}
                      `}
                    >
                      {/* glow ring on hover/active */}
                      <div
                        className={`pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 ${
                          active ? 'opacity-100' : 'group-hover:opacity-60'
                        }`}
                      >
                        <div className={`absolute -inset-px rounded-2xl bg-gradient-to-r ${accent} opacity-20 blur`} />
                      </div>

                      {/* image header */}
                      <button
                        onClick={() => onSelectCategory?.(cat)}
                        className="block w-full"
                        aria-label={`Browse ${cat.name}`}
                      >
                        <div className="relative h-44 w-full overflow-hidden bg-gray-100">
                          {cat.image ? (
                            <img
                              src={cat.image}
                              alt={cat.name}
                              className={`
                                h-full w-full object-cover transition-transform duration-700
                                ${active ? 'scale-[1.06]' : 'group-hover:scale-[1.04]'}
                              `}
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-50" />
                          )}
                          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${accent} opacity-25`} />
                          {showCounts && (
                            <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-gray-700 border border-gray-200 shadow-sm">
                              {total} items
                            </div>
                          )}
                          
                        </div>
                      </button>

                      {/* body */}
                      <div className="p-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-1">
                          {cat.name}
                        </h3>
                        {cat.description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{cat.description}</p>
                        )}

                        {/* top brands/subcategories */}
                        {topSub.length > 0 ? (
                          <div className="mb-4 flex flex-wrap gap-2">
                            {topSub.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => onSelectSubcategory?.(cat, s)}
                                className="
                                  inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1
                                  text-xs text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors
                                "
                              >
                                <Tags className="h-3.5 w-3.5 text-gray-500" />
                                <span className="truncate max-w-[8rem]">{s.name}</span>
                                {typeof s.productCount === 'number' && (
                                  <span className="text-gray-500">· {s.productCount}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="mb-4 text-xs text-gray-500">No subcategories yet</div>
                        )}

                        {/* CTA row */}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => onSelectCategory?.(cat)}
                            className="
                              rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-2
                              text-xs font-bold text-white hover:from-blue-700 hover:to-purple-700
                              focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500
                            "
                          >
                            Browse {cat.name}
                          </button>
                          <button
                            onClick={() => onSelectCategory?.(cat)}
                            className="text-xs text-blue-700 underline hover:text-blue-800"
                          >
                            View all
                          </button>
                        </div>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile arrows */}
          <div className="mt-4 flex sm:hidden items-center justify-center gap-2">
            <button
              onClick={scrollPrev}
              className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={scrollNext}
              className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Cinematic dots (bars) */}
          <div className="mt-3 flex items-center justify-center gap-2">
            {Array.from({ length: snapCount }).map((_, i) => {
              const active = i === selectedIndex;
              return (
                <button
                  key={i}
                  onClick={() => scrollTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`
                    h-1.5 rounded-full transition-all
                    ${active ? 'w-8 bg-blue-600' : 'w-3 bg-gray-300 hover:bg-gray-400'}
                  `}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CategoriesCarousel;
