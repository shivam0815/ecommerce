// src/components/HeroSlider.tsx
import React, { useMemo, useRef, useCallback } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation, A11y, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { Link } from 'react-router-dom';

type Slide = {
  link: string;
  bg: string;
  bgFallback?: string;
  bgMobile?: string;
  bgMobileFallback?: string;
  alt?: string;
  position?: string;
};

const slides: Slide[] = [
  { link: '/oem', bg: '/Front-Banner.webp', bgFallback: '/Front-Banner.jpg', bgMobile: '/Front-Banner-m.webp', bgMobileFallback: '/Front-Banner-m.jpg', alt: 'Bulk Order', position: 'center' },
  { link: '/products', bg: '/Earbuds-Poster.webp', bgFallback: '/Earbuds-Poster.jpg', bgMobile: '/Earbuds-Poster-m.webp', bgMobileFallback: '/Earbuds-Poster-m.jpg', alt: 'TWS Earbuds' },
  { link: '/oem', bg: '/Accessories-Poster-1.webp', bgFallback: '/Accessories-Poster-1.jpg', bgMobile: '/Accessories-Poster-1-m.webp', bgMobileFallback: '/Accessories-Poster-1-m.jpg', alt: 'Wholesale Accessories' },
  { link: '/products', bg: '/Tools-Display.webp', bgFallback: '/Tools-Display.jpg', bgMobile: '/Tools-Display-m.webp', bgMobileFallback: '/Tools-Display-m.jpg', alt: 'Best quality tools for mobile repairs' },
  { link: '/products', bg: '/Neckband-Poster.webp', bgFallback: '/Neckband-Poster.jpg', bgMobile: '/Neckband-Poster-m.webp', bgMobileFallback: '/Neckband-Poster-m.jpg', alt: 'Premium Neckband', position: 'center right' },
  { link: '/oem', bg: '/bna7.webp', bgFallback: '/bna7.jpg', bgMobile: '/bna7-m.webp', bgMobileFallback: '/bna7-m.jpg', alt: 'OEM Services' },
];

const HeroSlider: React.FC = () => {
  const prefersReduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
    []
  );

  const swiperRef = useRef<SwiperType | null>(null);

  const stop = useCallback(() => swiperRef.current?.autoplay?.stop?.(), []);
  const start = useCallback(() => {
    if (!prefersReduced) swiperRef.current?.autoplay?.start?.();
  }, [prefersReduced]);

  return (
    <section className="w-full relative" aria-label="Featured promotions" onMouseEnter={stop} onMouseLeave={start}>
      <Swiper
        modules={[Autoplay, Pagination, Navigation, A11y, Keyboard]}
        onSwiper={(sw) => (swiperRef.current = sw)}
        slidesPerView={1}
        centeredSlides
        loop
        spaceBetween={0}
        autoplay={prefersReduced ? false : { delay: 3500, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        navigation
        keyboard={{ enabled: true, onlyInViewport: true }}
        a11y={{ enabled: true }}
        className="hero-swiper"
      >
        {slides.map((s, i) => (
          <SwiperSlide key={i}>
  <Link to={s.link} className="block">
    <div className="relative w-full overflow-hidden bg-transparent">
      {/* aspect ratio wrapper keeps consistent height */}
      <div className="aspect-[16/9] sm:aspect-[21/9]">
        <picture>
          {s.bgMobile && (
            <source media="(max-width: 639px)" type="image/webp" srcSet={s.bgMobile} />
          )}
          {s.bgMobileFallback && (
            <source media="(max-width: 639px)" srcSet={s.bgMobileFallback} />
          )}
          <source type="image/webp" srcSet={s.bg} />
          {s.bgFallback && <source srcSet={s.bgFallback} />}
          <img
            src={s.bgFallback || s.bg}
            alt={s.alt || 'hero banner'}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"   // <- no object-contain on mobile
            style={{ objectPosition: s.position || 'center' }}
            onError={(e) => {
              const t = e.currentTarget;
              // swap to fallback if webp or main fails
              if (s.bgFallback && t.src !== window.location.origin + s.bgFallback) {
                t.src = s.bgFallback;
              }
            }}
          />
        </picture>
      </div>
    </div>
  </Link>
</SwiperSlide>

        ))}
      </Swiper>

      <style>{`
        .hero-swiper,
        .hero-swiper .swiper,
        .hero-swiper .swiper-wrapper,
        .hero-swiper .swiper-slide { height: auto; }
        .hero-swiper { --swiper-theme-color: #fff; }
        .hero-swiper .swiper-pagination-bullet { opacity:.7 }
        .hero-swiper .swiper-pagination-bullet-active { opacity:1 }
        .hero-swiper .swiper-button-next, .hero-swiper .swiper-button-prev {
          color:#fff; text-shadow:0 2px 10px rgba(0,0,0,.35)
        }
        @media (max-width:640px){
          .hero-swiper .swiper-button-next, .hero-swiper .swiper-button-prev { width:40px; height:40px }
        }
      `}</style>
    </section>
  );
};

export default HeroSlider;
