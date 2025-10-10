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
  position?: string;           // CSS object-position e.g., 'center' or '50% 35%'
  alt?: string;
  variants?: Record<number, string>;
  cloudinary?: boolean;
};

const slides: Slide[] = [
  {
    title: 'Bulk Order',
    subtitle: 'Feasible and Cost Effective',
    cta: 'Grab Deal',
    link: '/oem',
    bg: '/Front-Banner.webp',
    position: 'center',
    alt: 'Bulk packaging for large B2B orders',
  },
  {
    title: 'TWS Earbuds',
    subtitle: 'AirDopes Prime 701ANC',
    price: '₹2,199',
    cta: 'Shop Now',
    link: '/products',
    bg: '/Earbuds-Poster.webp',
    position: 'center',
    alt: 'Premium TWS earbuds on a gradient backdrop',
  },
  {
    title: 'Wholesale Mobile Accessories',
    subtitle: 'High-Quality Mobile Accessories at Competitive Prices',
    cta: 'Grab Deal',
    link: '/oem',
    bg: '/Accessories-Poster-1.webp',
    position: 'center',
    alt: 'Wholesale boxes of mobile accessories',
  },
  {
    title: 'Tools',
    subtitle: 'Durable & Reliable',
    price: '₹299',
    cta: 'Buy Cables',
    link: '/products',
    bg: '/Tools-Display.webp',
    position: 'center',
    alt: 'Best quality tools for mobile repairs',
  },
  {
    title: 'Premium Neckband',
    subtitle: 'Compact & Efficient',
    price: '₹899',
    cta: 'Grab Deal',
    link: '/products',
    bg: '/Neckband-Poster.webp',
    position: 'right center',
    alt: 'Compact for premium neckband headphones',
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

// responsive width breakpoints for srcset
const WIDTHS = [640, 768, 1024, 1280, 1536, 1920] as const;

const cloudinaryW = (url: string, w: number) =>
  url.includes('/upload/')
    ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${w}/`)
    : url;

const buildSrcSet = (s: Slide) => {
  if (s.variants && Object.keys(s.variants).length) {
    const pairs = Object.entries(s.variants)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([w, u]) => `${u} ${w}w`);
    pairs.push(`${s.bg} 2000w`);
    return pairs.join(', ');
  }
  if (s.cloudinary) {
    return WIDTHS.map((w) => `${cloudinaryW(s.bg, w)} ${w}w`).join(', ');
  }
  return WIDTHS.map((w) => `${s.bg} ${w}w`).join(', ');
};

const SIZES =
  '(min-width:1536px) 1536px, (min-width:1280px) 1280px, (min-width:1024px) 1024px, (min-width:768px) 768px, (min-width:640px) 640px, 100vw';

const HeroSlider: React.FC = () => {
  const prefersReduced = useMemo(
    () =>
      typeof window !== 'undefined'
        ? window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        : false,
    []
  );

  // Preload first slide for LCP
 useEffect(() => {
  const first = slides[0];
  if (!first) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = first.bg;
  link.setAttribute('imagesizes', SIZES);
  link.setAttribute('imagesrcset', buildSrcSet(first));
  // @ts-expect-error fetchpriority is not in TS DOM lib yet
  link.fetchpriority = 'high';

  // ensure the effect body returns nothing
  // and the cleanup returns a function with no value
  document.head.appendChild(link); // returns the node, but we ignore it
  return () => {
    if (link.parentNode) link.parentNode.removeChild(link); // returns void
  };
}, []);


  const onMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      if (prefersReduced) return;
      const swiperEl = (e.currentTarget as HTMLElement).querySelector('.swiper') as any;
      swiperEl?.swiper?.autoplay?.start?.();
    },
    [prefersReduced]
  );

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
        autoplay={prefersReduced ? false : { delay: 3000, disableOnInteraction: false }}
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
              <div className="relative w-full overflow-hidden">
                {/* aspect-ratio wrapper keeps image proportional on all screens */}
                <div className="aspect-[21/9] sm:aspect-[16/7] md:aspect-[16/6] lg:aspect-[16/5] xl:aspect-[21/7] min-h-[260px] sm:min-h-[340px] md:min-h-[420px]">
                  <picture>
                    <source type="image/webp" srcSet={srcSet} sizes={SIZES} />
                    <img
                      src={s.bg}
                      alt={s.alt ?? s.title}
                      loading={isFirst ? 'eager' : 'lazy'}
                      decoding="async"
                      // @ts-ignore
                      fetchpriority={isFirst ? 'high' : 'low'}
                      className="h-full w-full object-cover"
                      style={{ objectPosition: s.position || 'center' }}
                    />
                  </picture>
                </div>

                {/* scrim */}
                <div className="absolute inset-0 bg-black/35 md:bg-gradient-to-r md:from-black/70 md:via-black/30 md:to-transparent" />

                {/* text block */}
                <div className="absolute inset-0 z-10 flex items-center">
                  <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
                    <div className="w-full md:max-w-xl lg:max-w-2xl text-center md:text-left">
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

      {/* Controls and height fixes */}
      <style>{`
        .hero-swiper,
        .hero-swiper .swiper,
        .hero-swiper .swiper-wrapper,
        .hero-swiper .swiper-slide { height: auto; }

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
