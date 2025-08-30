import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const slides = [
  {
    title: '46dB Neckband',
    subtitle: 'AirDopes Prime 701ANC',
    price: '₹2,199',
    img: '/N-removebg-preview.png',
    cta: 'Shop Now',
    link: '/products',
    bg: 'bg-gradient-to-r from-gray-900 via-black to-gray-800',
  },
  {
    title: 'Fast Charging Cables',
    subtitle: 'Durable & Reliable',
    price: '₹299',
    img: '/cable.png',
    cta: 'Buy Cables',
     link: '/products',
    bg: 'bg-gradient-to-r from-blue-800 to-white to-gray -700',
  },
  {
    title: 'Premium Chargers',
    subtitle: 'Compact & Efficient',
    price: '₹899',
    img: '/charger.png',
    cta: 'Grab Deal',
    link: '/products',
    bg: 'bg-gradient-to-r from-slate-900 to-black to-white-700',
  },

   {
    title: 'Bulk Order',
    subtitle: 'FEASBLE AND COST EFFECTIVE',
    price: '₹',
    img: '/bulk.png',
    cta: 'Grab Deal',
    link: '/OEM',
    bg: 'bg-gradient-to-r from-slate-900 to-black to-white-700',
  },

  
];



const HeroSlider: React.FC = () => {
  return (
    <section className="w-full relative z-10">
      <Swiper
        spaceBetween={30}
        centeredSlides={true}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        navigation={true}
        modules={[Autoplay, Pagination, Navigation]}
        className="mySwiper"
      >
        {slides.map((slide, idx) => (
          <SwiperSlide key={idx}>
            <div className={`${slide.bg} text-white`}>
              <div className="grid grid-cols-1 md:grid-cols-2 items-center max-w-7xl mx-auto px-4 py-20 gap-8">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7 }}
                >
                  <h1 className="text-4xl md:text-6xl font-bold mb-4">
                    {slide.title}
                  </h1>
                  <p className="text-xl text-yellow-400 font-medium mb-4">
                    {slide.subtitle}
                  </p>
                  <p className="text-lg mb-6">Starting at <span className="font-bold">{slide.price}</span></p>
                 <Link
  to={slide.link}
  className="inline-block bg-yellow-400 text-black font-semibold px-6 py-3 rounded-lg hover:bg-yellow-300 transition"
>
  {slide.cta}
</Link>

                </motion.div>
                <motion.div
  initial={{ opacity: 0, x: 50 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.8 }}
  className="flex justify-center"
>
  <img
    src={slide.img}
    alt={slide.subtitle}
    className="rounded-xl object-contain shadow-lg w-[500px] h-[500px] md:w-[500px] md:h-[500px]"
    style={{
      backgroundColor: 'transparent',
    }}
  />
</motion.div>

              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
};



export default HeroSlider;
