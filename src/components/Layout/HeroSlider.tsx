import React, { useCallback, useEffect, useMemo } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation, A11y, Keyboard } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { Link } from 'react-router-dom';

type Slide = {
  title: string;
  subtitle?: string;
  price?: string;
  cta: string;
  link: string;
  bg: string;                  // default image
  position?: string;           // CSS object-position
  alt?: string;                // accessible alt text
  /** Optional responsive variants: width(px) -> url */
  variants?: Record<number, string>;
  /** If using Cloudinary, set true to auto-transform to widths below */
  cloudinary?: boolean;
};

const slides: Slide[] = [
  {
    title: 'TWS Earbuds',
    subtitle: 'AirDopes Prime 701ANC',
    price: '₹2,199',
    cta: 'Shop Now',
    link: '/products',
    bg: '/ban1.webp',
    position: 'center',
    alt: 'Premium TWS earbuds on a gradient backdrop',
    // Example variants if you export multiple sizes:
    // variants: { 640: '/ban1-640.webp', 1024: '/ban1-1024.webp', 1536: '/ban1-1536.webp', 1920: '/ban1-1920.webp' },
  },
  {
    title: 'Wholesale Mobile Accessories',
    subtitle: 'High-Quality Mobile Accessories at Competitive Prices',
    cta: 'Grab Deal',
    link: '/oem',
    bg: '/ban5.webp',
    position: 'center',
    alt: 'Wholesale boxes of mobile accessories',
    // variants: { 640: '/ban5-640.webp', 1024: '/ban5-1024.webp', 1536: '/ban5-1536.webp', 1920: '/ban5-1920.webp' },
  },
  {
    title: 'Fast Charging Cables',
    subtitle: 'Durable & Reliable',
    price: '₹299',
    cta: 'Buy Cables',
    link: '/products',
    bg: '/ban10.webp',
    position: 'center',
    alt: 'Type-C fast charging cable close-up',
  },
  {
    title: 'Premium Accessories',
    subtitle: 'Compact & Efficient',
    price: '₹899',
    cta: 'Grab Deal',
    link: '/products',
    bg: '/ban11.webp',
    position: 'right center',
    alt: 'Compact premium mobile charger and accessories',
  },
  {
    title: 'Bulk Order',
    subtitle: 'Feasible and Cost Effective',
    cta: 'Grab Deal',
    link: '/oem',
    bg: '/ban2.webp',
    position: 'center',
    alt: 'Bulk packaging for large B2B orders',
  },
  {
    title: 'OEM Services',
    subtitle: 'Your Brand, Our Expertise',
    cta: 'Grab Deal',
    link: '/oem',
    bg: '/bna7.webp',
    position: 'center',
    alt: 'OEM branding on accessories packaging',
  },
];

// Breakpoints you care about (must match your exported widths if using variants)
const WIDTHS = [640, 768, 1024, 1280, 1536, 1920] as const;

/** Build a Cloudinary URL with width transform */
const cloudinaryW = (url: string, w: number) =>
  url.includes('/upload/')
    ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${w}/`)
    : url;

/** Build srcset from slide config */
const buildSrcSet = (s: Slide) => {
  // Prefer explicit variants if present
  if (s.variants && Object.keys(s.variants).length) {
    const pairs = Object.entries(s.variants)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([w, u]) => `${u} ${w}w`);
    // Fallback include base bg too
    pairs.push(`${s.bg} 2000w`);
    return pairs.join(', ');
  }
  // If Cloudinary, auto-generate sized transforms
  if (s.cloudinary) {
    return WIDTHS.map((w) => `${cloudinaryW(s.bg, w)} ${w}w`).join(', ');
  }
  // Otherwise repeat base (still valid; not as optimal)
  return WIDTHS.map((w) => `${s.bg} ${w}w`).join(', ');
};

const SIZES =
  '(min-width:1536px) 1536px, (min-width:1280px) 1280px, (min-width:1024px) 1024px, (min-width:768px) 768px, (min-width:640px) 640px, 100vw';

const HeroSlider: React.FC = () => {
  const prefersReduced = useMemo(
    () => (typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches : false),
    []
  );

  // Preload the first slide image (best LCP)
  useEffect(() => {
    const first = slides[0];
    if (!first) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = first.bg;
    link.setAttribute('imagesizes', SIZES);
    link.setAttribute('imagesrcset', buildSrcSet(first));
    // Higher priority for the first image
    (link as any).fetchpriority = 'high';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Pause autoplay on hover/focus; resume on leave/blur
  const onMouseEnter = useCallback((e: React.MouseEvent) => {
    const swiperEl = (e.currentTarget as HTMLElement).querySelector('.swiper') as any;
    swiperEl?.swiper?.autoplay?.stop?.();
  }, []);
  const onMouseLeave = useCallback((e: React.MouseEvent) => {
    if (prefersReduced) return;
    const swiperEl = (e.currentTarget as HTMLElement).querySelector('.swiper') as any;
    swiperEl?.swiper?.autoplay?.start?.();
  }, [prefersReduced]);

  return (
    <section
      className="w-full relative"
      aria-label="Featured promotions carousel"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Swiper
        modules={[Autoplay, Pagination, Navigation, A11y, Keyboard]}
        slidesPerView={1}
        centeredSlides
        loop
        spaceBetween={0}
        autoplay={prefersReduced ? false : { delay: 4500, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        navigation
        keyboard={{ enabled: true, onlyInViewport: true }}
        a11y={{
          enabled: true,
          prevSlideMessage: 'Previous slide',
          nextSlideMessage: 'Next slide',
          firstSlideMessage: 'This is the first slide',
          lastSlideMessage: 'This is the last slide',
          slideLabelMessage: '{{index}} / {{slidesLength}}',
        }}
        className="hero-swiper"
      >
        {slides.map((s, i) => {
          const srcSet = buildSrcSet(s);
          const isFirst = i === 0;
          return (
            <SwiperSlide key={i} aria-roledescription="slide">
              <div className="relative w-full h-[52vh] sm:h-[60vh] md:h-[72vh] lg:h-[80vh] xl:h-[86vh] overflow-hidden">
                {/* Responsive image */}
                <picture>
                  {/* If you have jpeg fallbacks, add another <source type="image/jpeg" ... /> */}
                  <source type="image/webp" srcSet={srcSet} sizes={SIZES} />
                  <img
                    src={s.bg}
                    alt={s.alt ?? s.title}
                    loading={isFirst ? 'eager' : 'lazy'}
                    decoding="async"
                    // @ts-ignore
                    fetchpriority={isFirst ? 'high' : 'low'}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ objectPosition: s.position || 'center' }}
                  />
                </picture>

                {/* Scrim for contrast */}
                <div className="absolute inset-0 bg-black/35 md:bg-gradient-to-r md:from-black/70 md:via-black/30 md:to-transparent" />

                {/* TEXT */}
                <div className="relative z-10 h-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
                  <div className="h-full flex items-center text-center md:text-left justify-center md:justify-start">
                    <div className="w-full md:max-w-xl lg:max-w-2xl">
                      <h1 className="text-white font-extrabold leading-tight text-3xl xs:text-4xl sm:text-5xl md:text-6xl">
                        {s.title}
                      </h1>
                      {s.subtitle && (
                        <p className="mt-3 text-yellow-300 font-semibold text-base sm:text-lg md:text-2xl">
                          {s.subtitle}
                        </p>
                      )}
                      {s.price && (
                        <p className="mt-4 text-white text-base sm:text-lg md:text-xl">
                          Starting at <span className="font-bold">{s.price}</span>
                        </p>
                      )}
                      <Link
                        to={s.link}
                        className="inline-block mt-6 rounded-lg font-semibold px-5 py-3 sm:px-6 sm:py-3.5
                                   bg-yellow-400 text-black hover:bg-yellow-300
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black
                                   transition"
                        aria-label={`${s.cta}: ${s.title}`}
                      >
                        {s.cta}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>

      {/* Ensure controls visible */}
      <style>{`
        .hero-swiper { --swiper-theme-color: #fff; }
        .hero-swiper .swiper-pagination-bullet { opacity: .7; }
        .hero-swiper .swiper-pagination-bullet-active { opacity: 1; }
        .hero-swiper .swiper-button-next, .hero-swiper .swiper-button-prev {
          color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,.35);
        }
        @media (max-width: 640px) {
          .hero-swiper .swiper-button-next, .hero-swiper .swiper-button-prev { width: 42px; height: 42px; }
        }
      `}</style>
    </section>
  );
};

export default HeroSlider;
