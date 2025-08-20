import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Search, FolderOpenDot, Sparkles, Tags } from 'lucide-react';

/* ------------------------------- Types ------------------------------- */

export type Subcategory = {
  id: string;
  name: string;
  productCount?: number;
  slug?: string;
};

export type CategoryItem = {
  id: string;
  name: string;
  description?: string;
  image?: string;      // optional preview image (first product image, banner, etc.)
  accent?: string;     // tailwind gradient like "from-blue-600 to-purple-600"
  subcategories?: Subcategory[];
};

type Props = {
  categories: CategoryItem[];
  className?: string;

  onSelectCategory?: (category: CategoryItem) => void;
  onSelectSubcategory?: (category: CategoryItem, sub: Subcategory) => void;

  /** Optional hero slideshow; if omitted, we auto-use category.images (deduped) */
  heroImages?: string[];
  /** Bright hero gradient to match your site */
  heroGradient?: string; // default: from-blue-600 via-purple-600 to-blue-800
  /** Subtle overlay over images to keep text crisp */
  overlayTint?: string;  // default: bg-white/10
  /** If true, and heroImages not provided, will gather from category.image */
  autoUseCategoryImages?: boolean;

  /** Optional controlled search input */
  searchValue?: string;
  onSearchChange?: (q: string) => void;
};

/* --------------------------- Main Component -------------------------- */

const CategoriesCinematic: React.FC<Props> = ({
  categories,
  className = '',
  onSelectCategory,
  onSelectSubcategory,

  heroImages,
  heroGradient = 'from-blue-600 via-purple-600 to-blue-800',
  overlayTint = 'bg-white/10',
  autoUseCategoryImages = true,

  searchValue,
  onSearchChange,
}) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const q = (searchValue ?? internalSearch).trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return categories;
    return categories
      .map((c) => ({
        ...c,
        subcategories: (c.subcategories || []).filter((s) =>
          s.name.toLowerCase().includes(q)
        ),
      }))
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q) ||
          (c.subcategories || []).length > 0
      );
  }, [categories, q]);

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSearch = (value: string) => {
    onSearchChange ? onSearchChange(value) : setInternalSearch(value);
  };

  // Build a light hero slideshow automatically from category images if not provided
  const autoImages = useMemo(() => {
    if (!autoUseCategoryImages) return [];
    const imgs = categories.map((c) => c.image).filter(Boolean) as string[];
    return Array.from(new Set(imgs)).slice(0, 6);
  }, [categories, autoUseCategoryImages]);

  const slideshow = (heroImages && heroImages.length ? heroImages : autoImages) as string[];

  return (
    <div className={`relative min-h-screen bg-white text-gray-900 ${className}`}>
      <HeroBackdropLight images={slideshow} heroGradient={heroGradient} overlayTint={overlayTint} />

      {/* ------------------------------ Hero ------------------------------ */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/60 px-3 py-1 backdrop-blur-sm text-sm text-gray-700 shadow-sm">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Explore by Category
            </div>

            <h1 className="mt-4 text-4xl md:text-6xl font-extrabold tracking-tight text-white">
              Premium Tech Accessories
            </h1>

            <p className="mt-3 text-white/95 max-w-2xl mx-auto">
              Discover our curated collection with a bright, cinematic browsing experience.
            </p>

            <div className="mt-8 max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  value={searchValue ?? internalSearch}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search categories or subcategories..."
                  className="w-full rounded-xl bg-white border border-gray-300 pl-10 pr-4 py-3 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --------------------------- Categories --------------------------- */}
      <section className="relative -mt-6 pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Meta line */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
              <FolderOpenDot className="h-5 w-5 text-blue-600" />
              <span className="text-gray-700">
                Showing <strong className="text-gray-900">{filtered.length}</strong> of{' '}
                <strong className="text-gray-900">{categories.length}</strong> categories
              </span>
            </div>
          </div>

          {/* Accordion list */}
          <div className="space-y-6">
            {filtered.map((cat, idx) => {
              const open = openIds.has(cat.id);
              const accent = cat.accent || 'from-blue-600 to-purple-600';

              return (
                <motion.article
                  key={cat.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.45, ease: 'easeOut' }}
                  className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-white/95 backdrop-blur-md shadow-sm hover:shadow-lg transition-all duration-500"
                >
                  {/* Subtle gradient glow + sheen on hover */}
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className={`absolute -inset-px rounded-3xl bg-gradient-to-r ${accent} opacity-15 blur`} />
                    <div className="absolute inset-0 rounded-3xl bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.25),transparent)] translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  </div>

                  {/* Header */}
                  <button
                    onClick={() => toggle(cat.id)}
                    onDoubleClick={() => onSelectCategory?.(cat)}
                    className="w-full text-left"
                    aria-expanded={open}
                    aria-controls={`panel-${cat.id}`}
                  >
                    <div className="grid grid-cols-[auto,1fr,auto] gap-6 items-center p-6 sm:p-8">
                      {/* Thumb */}
                      <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm">
                        {cat.image ? (
                          <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-50" />
                        )}
                        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-10`} />
                      </div>

                      {/* Title + Desc */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-700 border border-blue-100">
                            CATEGORY
                          </span>
                          {Boolean(cat.subcategories?.length) && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                              <Tags className="h-3.5 w-3.5 text-gray-500" />
                              {cat.subcategories!.length} subcategories
                            </span>
                          )}
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">{cat.name}</h3>
                        {cat.description && (
                          <p className="mt-1 text-gray-600 line-clamp-2">{cat.description}</p>
                        )}
                      </div>

                      {/* Chevron */}
                      <div className="justify-self-end">
                        <motion.div
                          animate={{ rotate: open ? 180 : 0 }}
                          transition={{ duration: 0.25 }}
                          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 border border-gray-200 text-blue-700 group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors duration-300"
                        >
                          <ChevronDown className="h-6 w-6" />
                        </motion.div>
                      </div>
                    </div>
                  </button>

                  {/* Panel */}
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        id={`panel-${cat.id}`}
                        initial="collapsed"
                        animate="open"
                        exit="collapsed"
                        variants={{ open: { height: 'auto', opacity: 1 }, collapsed: { height: 0, opacity: 0 } }}
                        transition={{ duration: 0.35, ease: 'easeInOut' }}
                        className="overflow-hidden border-t border-gray-200"
                      >
                        <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-blue-50/40 to-purple-50/40">
                          {cat.subcategories && cat.subcategories.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {cat.subcategories.map((s) => (
                                <motion.button
                                  key={s.id}
                                  onClick={() => onSelectSubcategory?.(cat, s)}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 text-left text-gray-800 hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 shadow-sm hover:shadow-md"
                                >
                                  <div className="min-w-0 flex items-center gap-3">
                                    <ChevronRight className="h-4 w-4 text-blue-600 group-hover:translate-x-1 transition-transform duration-200" />
                                    <span className="truncate font-medium">{s.name}</span>
                                  </div>
                                  <span className="text-sm text-blue-700 bg-blue-100 px-2 py-1 rounded-full font-medium">
                                    {s.productCount ?? 0}
                                  </span>
                                </motion.button>
                              ))}
                            </div>
                          ) : (
                            <div className="text-gray-600 text-center py-8 bg-white rounded-2xl border border-gray-200">
                              <Tags className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                              <p className="font-medium">No subcategories available yet</p>
                            </div>
                          )}

                          {/* CTA Row */}
                          <div className="mt-6 flex flex-wrap items-center gap-4">
                            <motion.button
                              onClick={() => onSelectCategory?.(cat)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 text-sm font-bold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-md hover:shadow-lg"
                            >
                              <FolderOpenDot className="h-4 w-4" />
                              Browse {cat.name}
                            </motion.button>
                            <span className="text-gray-600 text-xs">
                              Double-click the header to jump directly.
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-16 text-center"
            >
              <div className="text-6xl mb-4">🔎</div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-1">No categories found</h3>
              <p className="text-gray-600">Try adjusting your search.</p>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
};

export default CategoriesCinematic;

/* ----------------------- Light Hero Backdrop ------------------------ */

const HeroBackdropLight: React.FC<{
  images?: string[];
  heroGradient: string;
  overlayTint: string;
}> = ({ images = [], heroGradient, overlayTint }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!images.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % images.length), 5000);
    return () => clearInterval(t);
  }, [images.length]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* Bright brand gradient (blue → purple) */}
      <div className={`absolute inset-0 bg-gradient-to-r ${heroGradient}`} />

      {/* Subtle slideshow on top of gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {images.length > 0 && (
            <motion.img
              key={idx + images[idx]}
              src={images[idx]}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 0.22, scale: 1.1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Very light overlay so text stays crisp */}
      <div className={`absolute inset-0 ${overlayTint}`} />
    </div>
  );
};
