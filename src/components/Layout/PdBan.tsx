import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
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
  bg: string;                // banner image path
  position?: string;         // CSS background-position (e.g., 'center right')
};

const slides: Slide[] = [
  {
    title: 'TWS Earbuds',
    subtitle: 'AirDopes Prime 701ANC',
    price: '₹2,199',
    cta: 'Shop Now',
    link: '/products',
    bg: '/ban1.webp',
    position: 'middle',      // adjust per image focal point
  },


   {
    title: 'Wholesale Mobile Accessories',
    subtitle: 'High-Quality Mobile Accessories at Competitive Prices',
    cta: 'Grab Deal',
    link: '/OEM',
    bg: '/ban5.webp',
    position: 'center',
  },
  {
    title: 'Fast Charging Cables',
    subtitle: 'Durable & Reliable',
    price: '₹299',
    cta: 'Buy Cables',
    link: '/products',
    bg: '/ban10.webp', // use a wide banner image (1920×700+)
    position: 'center',
  },
  {
    title: 'Premium Accessories',
    subtitle: 'Compact & Efficient',
    price: '₹899',
    cta: 'Grab Deal',
    link: '/products',
    bg: '/ban11.webp',
    position: 'center right',
  },
  {
    title: 'Bulk Order',
    subtitle: 'FEASIBLE AND COST EFFECTIVE',
    cta: 'Grab Deal',
    link: '/OEM',
    bg: '/ban2.webp',
    position: 'center',
  },

   {
    title: 'OEM Services',
    subtitle: 'Your Brand, Our Expertise',
    cta: 'Grab Deal',
    link: '/OEM',
    bg: '/bna7.webp',
    position: 'center',
  },
  
];

const PdBan: React.FC = () => {
  return (
    <section className="w-full relative">
      <Swiper
        modules={[Autoplay, Pagination, Navigation]}
        slidesPerView={1}
        centeredSlides
        loop
        spaceBetween={0}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        navigation
        className="hero-swiper"
      >
        {slides.map((s, i) => (
          <SwiperSlide key={i}>
            {/* FULL-BLEED BACKGROUND */}
            <div
              aria-label={s.title}
              className="relative w-full h-[52vh] sm:h-[60vh] md:h-[72vh] lg:h-[80vh] xl:h-[86vh] overflow-hidden"
              style={{
                backgroundImage: `url(${s.bg})`,
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: s.position || 'center',
              }}
            >
              {/* Readability scrim over image */}
              <div className="absolute inset-0 bg-black/30 md:bg-gradient-to-r md:from-black/70 md:via-black/30 md:to-transparent" />

              {/* TEXT OVERLAY */}
              <div className="relative z-10 h-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 flex items-center">
                <div className="w-full md:w-2/3 lg:w-1/2">
                  <h1 className="text-white text-4xl md:text-6xl font-extrabold leading-tight">
                    {s.title}
                  </h1>

                  {s.subtitle && (
                    <p className="mt-3 text-yellow-400 text-lg md:text-2xl font-semibold">
                      {s.subtitle}
                    </p>
                  )}

                  {s.price && (
                    <p className="mt-4 text-white text-lg md:text-xl">
                      Starting at <span className="font-bold">{s.price}</span>
                    </p>
                  )}

                  <Link
                    to={s.link}
                    className="inline-block mt-6 bg-yellow-400 text-black font-semibold px-6 py-3 rounded-lg hover:bg-yellow-300 transition"
                  >
                    {s.cta}
                  </Link>
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Make arrows & bullets visible over photos */}
      <style>{`
        .hero-swiper { --swiper-theme-color: #fff; }
        .hero-swiper .swiper-pagination-bullet { opacity: .7; }
        .hero-swiper .swiper-pagination-bullet-active { opacity: 1; }
        .hero-swiper .swiper-button-next, .hero-swiper .swiper-button-prev {
          color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,.35);
        }
      `}</style>
    </section>
  );
};

export default PdBan;
