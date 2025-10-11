// src/components/HeroSlider.tsx
import React, { useCallback, useMemo } from 'react';
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
  bg: string;          // desktop
  bgMobile?: string;   // mobile
  alt?: string;
  position?: string;       // desktop focal point
  positionMobile?: string; // mobile focal point
};

const slides: Slide[] = [
  { title: 'Bulk Order', cta: 'Grab Deal', link: '/oem', bg: '/Front-Banner.webp', bgMobile: '/Front-Banner-m.webp', alt: 'Bulk packaging', position: 'center', positionMobile: 'center' },
  { title: 'TWS Earbuds', cta: 'Shop Now', link: '/products', bg: '/Earbuds-Poster.webp', bgMobile: '/Earbuds-Poster-m.webp', alt: 'TWS earbuds', position: 'center', positionMobile: 'center 30%' },
  { title: 'Wholesale Mobile Accessories', cta: 'Grab Deal', link: '/oem', bg: '/Accessories-Poster-1.webp', bgMobile: '/Accessories-Poster-1-m.webp', alt: 'Wholesale boxes' },
  { title: 'Tools', cta: 'Buy Now', link: '/products', bg: '/Tools-Display.webp', bgMobile: '/Tools-Display-m.webp', alt: 'Repair tools' },
  { title: 'Premium Neckband', cta: 'Grab Deal', link: '/products', bg: '/Neckband-Poster.webp', bgMobile: '/Neckband-Poster-m.webp', alt: 'Neckband', position: 'right center', positionMobile: 'center 35%' },
  { title: 'OEM Services', cta: 'Grab Deal', link: '/oem', bg: '/bna7.webp', bgMobile: '/bna7-m.webp', alt: 'OEM services' },
];

const HeroSlider: React.FC = () => {
  const prefersReduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
    []
  );

  const stop = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = (e.currentTarget as HTMLElement).querySelector('.swiper') as any;
    el?.swiper?.autoplay?.stop?.();
  }, []);
  const start = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (prefersReduced) return;
    const el = (e.currentTarget as HTMLElement).querySelector('.swiper') as any;
    el?.swiper?.autoplay?.start?.();
  }, [prefersReduced]);

  return (
    <section className="w-full relative" aria-label="Featured promotions" onMouseEnter={stop} onMouseLeave={start}>
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
        {slides.map((s, i) => (
          <SwiperSlide key={i} aria-roledescription="slide">
            <Link to={s.link} className="block group focus:outline-none">
              <div className="relative w-full overflow-hidden">
                {/* Ratio wrapper: 125% on mobile (~4:5), 56.25% on ≥sm (16:9) */}
                <div className="relative w-full pt-[125%] sm:pt-[56.25%] min-h-[260px] sm:min-h-[360px]">
                  <picture>
                    {/* mobile first */}
                    {s.bgMobile && <source media="(max-width: 639px)" srcSet={s.bgMobile} />}
                    {/* desktop/default */}
                    <img
                      src={s.bg}
                      alt={s.alt ?? s.title}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{
                        objectPosition:
                          typeof window !== 'undefined' && window.innerWidth < 640
                            ? (s.positionMobile || s.position || 'center')
                            : (s.position || 'center'),
                      }}
                      width={1920}
                      height={1080}
                    />
                  </picture>
                  {/* optional faint scrim */}
                  <div className="pointer-events-none absolute inset-0 bg-black/10" />
                </div>
                <span className="sr-only">{s.title}. {s.cta}.</span>
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
        .hero-swiper img { display: block; }
        .hero-swiper .swiper-pagination-bullet { opacity:.7; }
        .hero-swiper .swiper-pagination-bullet-active { opacity:1; }
        .hero-swiper .swiper-button-next, .hero-swiper .swiper-button-prev { color:#fff; text-shadow:0 2px 10px rgba(0,0,0,.35); }
        @media (max-width:640px){ .hero-swiper .swiper-button-next, .hero-swiper .swiper-button-prev{ width:42px; height:42px; } }
      `}</style>
    </section>
  );
};

export default HeroSlider;
