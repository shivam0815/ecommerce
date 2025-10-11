// src/components/HeroSlider.tsx
import React, { useCallback, useEffect, useMemo } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation, A11y, Keyboard } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { Link } from 'react-router-dom';

type Slide = {
  title: string;
  cta: string;
  link: string;
  bg: string;                 // desktop/wide image
  bgMobile?: string;          // mobile/tall image (optional)
  position?: string;          // desktop focal point
  positionMobile?: string;    // mobile focal point
  alt?: string;
};

const slides: Slide[] = [
  {
    title: 'Bulk Order',
    cta: 'Grab Deal',
    link: '/oem',
    bg: '/Front-Banner.webp',
    bgMobile: '/Front-Banner-m.webp',
    position: 'center',
    positionMobile: 'center',
    alt: 'Bulk packaging for large B2B orders',
  },
  {
    title: 'TWS Earbuds',
    cta: 'Shop Now',
    link: '/products',
    bg: '/Earbuds-Poster.webp',
    bgMobile: '/Earbuds-Poster-m.webp',
    position: 'center',
    positionMobile: 'center 30%',
    alt: 'Premium TWS earbuds',
  },
  {
    title: 'Wholesale Mobile Accessories',
    cta: 'Grab Deal',
    link: '/oem',
    bg: '/Accessories-Poster-1.webp',
    bgMobile: '/Accessories-Poster-1-m.webp',
    position: 'center',
    positionMobile: 'center',
    alt: 'Wholesale boxes of mobile accessories',
  },
  {
    title: 'Tools',
    cta: 'Buy Now',
    link: '/products',
    bg: '/Tools-Display.webp',
    bgMobile: '/Tools-Display-m.webp',
    position: 'center',
    positionMobile: 'center',
    alt: 'Best quality tools for mobile repairs',
  },
  {
    title: 'Premium Neckband',
    cta: 'Grab Deal',
    link: '/products',
    bg: '/Neckband-Poster.webp',
    bgMobile: '/Neckband-Poster-m.webp',
    position: 'right center',
    positionMobile: 'center 35%',
    alt: 'Premium neckband headphones',
  },
  {
    title: 'OEM Services',
    cta: 'Grab Deal',
    link: '/oem',
    bg: '/bna7.webp',
    bgMobile: '/bna7-m.webp',
    position: 'center',
    positionMobile: 'center',
    alt: 'OEM branding on accessories packaging',
  },
];

const SIZES =
  '(min-width:1024px) 1024px, (min-width:768px) 768px, 100vw';

const HeroSlider: React.FC = () => {
  const prefersReduced = useMemo(
    () =>
      typeof window !== 'undefined'
        ? window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        : false,
    []
  );

  // Preload first slide images for LCP (desktop + mobile)
  useEffect(() => {
    const first = slides[0];
    if (!first) return;

    const linkDesk = document.createElement('link');
    linkDesk.rel = 'preload';
    linkDesk.as = 'image';
    linkDesk.href = first.bg;
    // @ts-expect-error
    linkDesk.fetchpriority = 'high';
    document.head.appendChild(linkDesk);

    const linkMob = document.createElement('link');
    linkMob.rel = 'preload';
    linkMob.as = 'image';
    linkMob.href = first.bgMobile || first.bg;
    // @ts-expect-error
    linkMob.fetchpriority = 'high';
    document.head.appendChild(linkMob);

    return () => {
      linkDesk.parentNode?.removeChild(linkDesk);
      linkMob.parentNode?.removeChild(linkMob);
    };
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const swiperEl = (e.currentTarget as HTMLElement).querySelector('.swiper') as any;
    swiperEl?.swiper?.autoplay?.stop?.();
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (prefersReduced) return;
    const swiperEl = (e.currentTarget as HTMLElement).querySelector('.swiper') as any;
    swiperEl?.swiper?.autoplay?.start?.();
  }, [prefersReduced]);

  return (
    <section
      className="w-full relative"
      aria-label="Featured promotions carousel"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
        a11y={{ enabled: true }}
        autoHeight
        className="hero-swiper"
      >
        {slides.map((s, i) => {
          const isFirst = i === 0;
          return (
            <SwiperSlide key={i} aria-roledescription="slide">
              {/* Entire slide is the link. No text overlay. */}
              <Link to={s.link} className="block group focus:outline-none">
                <div className="relative w-full overflow-hidden">
                  {/* Tall on mobile, wide on desktop */}
                  <div className="aspect-[4/5] sm:aspect-[16/9] min-h-[260px] sm:min-h-[360px]">
                    <picture>
                      {/* Desktop source */}
                      <source media="(min-width: 640px)" srcSet={s.bg} />
                      {/* Mobile fallback */}
                      <img
                        src={s.bgMobile || s.bg}
                        alt={s.alt ?? s.title}
                        loading={isFirst ? 'eager' : 'lazy'}
                        decoding="async"
                        sizes={SIZES}
                        // @ts-ignore
                        fetchpriority={isFirst ? 'high' : 'low'}
                        className="block h-full w-full object-cover"
                        // object-position differs by breakpoint via CSS variables
                        style={
                          {
                            '--obj-pos-mobile': s.positionMobile || s.position || 'center',
                            '--obj-pos-desktop': s.position || 'center',
                            objectPosition:
                              typeof window !== 'undefined' && window.innerWidth >= 640
                                ? (s.position || 'center')
                                : (s.positionMobile || s.position || 'center'),
                          } as React.CSSProperties
                        }
                      />
                    </picture>
                  </div>

                  {/* Optional subtle scrim to improve contrast if you add badges later */}
                  <div className="pointer-events-none absolute inset-0 bg-black/10" />
                  <span className="sr-only">{s.title}. {s.cta}.</span>
                </div>
              </Link>
            </SwiperSlide>
          );
        })}
      </Swiper>

      <style>{`
        .hero-swiper,
        .hero-swiper .swiper,
        .hero-swiper .swiper-wrapper,
        .hero-swiper .swiper-slide { height: auto; }
        .hero-swiper img { display: block; } /* remove inline-img gap */
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
