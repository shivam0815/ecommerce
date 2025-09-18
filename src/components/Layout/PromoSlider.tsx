import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingBag, Zap, Gift, Percent, Sparkles, Star } from 'lucide-react';

interface PromoSlide {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  buttonText: string;
  buttonLink: string;
  backgroundGradient: string;
  image: string;
  badge?: string;
  price?: {
    original: number;
    discounted: number;
    discount: number;
  };
  features?: string[];
}

const PromoSlider: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // 👉 Update image paths if needed (I used simple filenames; put them in /public or adjust)
  const promoSlides: PromoSlide[] = [
    // ---- Existing 4 ----
    {
      id: 1,
      title: "Premium TWS Collection",
      subtitle: "New Arrival",
      description: "Experience crystal clear sound with our latest True Wireless Stereo earbuds. Advanced noise cancellation and 24-hour battery life.",
      buttonText: "Shop TWS Now",
      buttonLink: "/products?category=true-wireless-stereo",
      backgroundGradient: "from-purple-600 via-blue-600 to-teal-500",
      image: "/Earbud-removebg-preview.png",
      badge: "New Launch",
      price: { original: 4999, discounted: 2499, discount: 50 },
      features: ["Active Noise Cancellation", "24H Battery", "IPX7 Waterproof"]
    },
    {
      id: 2,
      title: "Fast Charging Solutions",
      subtitle: "Power Up Instantly",
      description: "Get lightning-fast charging with our premium chargers and cables. Compatible with all major smartphone brands.",
      buttonText: "Explore Chargers",
      buttonLink: "/products?category=mobile-charger",
      backgroundGradient: "from-sky-400 via-blue-500 to-cyan-600",
      image: "/Charger1.webp",
      badge: "Hot Deal",
      price: { original: 1999, discounted: 999, discount: 50 },
      features: ["Quick Charge 3.0", "Universal Compatibility", "Safe Charging"]
    },
    {
      id: 3,
      title: "Professional Repair Tools",
      subtitle: "For Technicians",
      description: "Complete toolkit for mobile repair professionals. High-quality instruments for precise work.",
      buttonText: "View Tools",
      buttonLink: "/products?category=mobile-repairing-tools",
      backgroundGradient: "from-gray-700 via-blue-800 to-indigo-900",
      image: "/Reapring-Tools.webp",
      badge: "Professional",
      price: { original: 2999, discounted: 1999, discount: 33 },
      features: ["Premium Quality", "Complete Set", "Professional Grade"]
    },
    {
      id: 4,
      title: "Car Charger",
      subtitle: "Drive Smart",
      description: "Enhance your driving experience with our premium car chargers, mounts, and accessories.",
      buttonText: "Shop Car Gear",
      buttonLink: "/products?category=car-charger",
      backgroundGradient: "from-green-600 via-teal-600 to-blue-600",
      image: "/CarCharger.webp",
      badge: "Trending",
      price: { original: 1499, discounted: 799, discount: 47 },
      features: ["Universal Fit", "Secure Mount", "Fast Charging"]
    },

    // ---- New: Cables ----
    {
      id: 5,
      title: "Ultra-Durable Cables",
      subtitle: "Charge & Sync",
      description: "Braided, tangle-free cables with fast data transfer and stable charging. Type-C, Lightning & Micro-USB available.",
      buttonText: "Shop Cables",
      buttonLink: "/products?category=data-cable",
      backgroundGradient: "from-indigo-600 via-violet-600 to-fuchsia-500",
      image: "/cable.png",
      badge: "Best Seller",
      price: { original: 799, discounted: 399, discount: 50 },
      features: ["High Speed Sync", "Braided Build", "1m & 2m Options"]
    },

    // ---- New: Neckbands ----
    {
      id: 6,
      title: "Neckband Series",
      subtitle: "Comfort + Bass",
      description: "Lightweight neckbands with deep bass, clear calls, magnetic buds and all-day comfort.",
      buttonText: "Shop Neckbands",
      buttonLink: "/products?category=neckband",
      backgroundGradient: "from-rose-500 via-red-500 to-orange-500",
      image: "/Neckband-removebg-preview.png",
      badge: "Customer Favorite",
      price: { original: 2999, discounted: 1499, discount: 50 },
      features: ["BT 5.x", "Dual Pairing", "Up to 30H Playtime"]
    },

    // ---- New: Speakers ----
    {
      id: 7,
      title: "Wireless Speakers",
      subtitle: "Big Sound, Compact Size",
      description: "Portable speakers with punchy bass, splash resistance and long battery life—perfect for indoors & outdoors.",
      buttonText: "Shop Speakers",
      buttonLink: "/products?category=wireless-speakers",
      backgroundGradient: "from-amber-500 via-yellow-500 to-lime-500",
      image: "/Bluetooth-Speaker.webp",
      badge: "Party Ready",
      price: { original: 3999, discounted: 2299, discount: 42 },
      features: ["Deep Bass", "IPX Rating", "12–20H Battery"]
    },

    // ---- New: Power Banks ----
    {
      id: 8,
      title: "High-Capacity Power Banks",
      subtitle: "Charge On The Go",
      description: "Fast-charging power banks with multi-port output and smart protection. 10,000–20,000 mAh options.",
      buttonText: "Shop Power Banks",
      buttonLink: "/products?category=power-bank",
      backgroundGradient: "from-cyan-600 via-teal-600 to-emerald-600",
      image: "/Powerbank.webp",
      badge: "Must-Have",
      price: { original: 2499, discounted: 1599, discount: 36 },
      features: ["PD/Quick Charge", "Multi-Port", "Smart Protection"]
    }
  ];

  // Auto-advance slides
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % promoSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [promoSlides.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % promoSlides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + promoSlides.length) % promoSlides.length);
  const goToSlide = (index: number) => setCurrentSlide(index);

  const currentSlideData = promoSlides[currentSlide];

  return (
    <section className="relative h-[400px] sm:h-[500px] md:h-[600px] lg:h-[650px] xl:h-[700px] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`absolute inset-0 bg-gradient-to-r ${currentSlideData.backgroundGradient}`}
        >
          {/* Enhanced Background Pattern with Cinematic Effects */}
          <div className="absolute inset-0 opacity-5 sm:opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_white_1px,_transparent_1px)] bg-[length:15px_15px] sm:bg-[length:20px_20px]" />
          </div>

          {/* Floating Particles */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 sm:w-2 sm:h-2 bg-white rounded-full opacity-20 sm:opacity-30"
                style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
                animate={{ y: [-10, -30, -10], x: [0, Math.random() * 15 - 7.5, 0], opacity: [0.1, 0.3, 0.1], scale: [0.5, 1, 0.5] }}
                transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2, ease: "easeInOut" }}
              />
            ))}
          </div>

          {/* Light Rays */}
          <motion.div
            className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 md:w-96 md:h-96 bg-gradient-radial from-white via-transparent to-transparent opacity-10 sm:opacity-20"
            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
            transition={{ rotate: { duration: 30, repeat: Infinity, ease: "linear" }, scale: { duration: 8, repeat: Infinity, ease: "easeInOut" } }}
          />

          <div className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 h-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8 h-full items-center">
              
              {/* Content */}
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -30, opacity: 0 }}
                transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                className="text-white space-y-3 sm:space-y-4 md:space-y-6 px-2 sm:px-0 py-4 sm:py-6 lg:py-0"
              >
                {/* Badge */}
                {currentSlideData.badge && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                    className="inline-flex items-center relative"
                  >
                    <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 border border-white border-opacity-30 relative overflow-hidden">
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
                        animate={{ x: [-100, 100] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      />
                      <div className="flex items-center space-x-1 sm:space-x-2 relative z-10">
                        <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                          <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                        </motion.div>
                        <span className="text-xs sm:text-sm font-semibold">{currentSlideData.badge}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Subtitle */}
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm sm:text-base md:text-lg font-medium opacity-90"
                >
                  <motion.span animate={{ color: ["#ffffff", "#ffdd44", "#ffffff"] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                    {currentSlideData.subtitle}
                  </motion.span>
                </motion.p>

                {/* Title */}
                <motion.h1
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight"
                >
                  {currentSlideData.title.split(' ').map((word, index) => (
                    <motion.span
                      key={index}
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className="inline-block mr-2"
                    >
                      {word}
                    </motion.span>
                  ))}
                </motion.h1>

                {/* Description */}
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-xs sm:text-sm md:text-base lg:text-lg opacity-90 leading-relaxed max-w-lg"
                >
                  {currentSlideData.description}
                </motion.p>

                {/* Features */}
                {currentSlideData.features?.length ? (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3"
                  >
                    {currentSlideData.features.map((feature, index) => (
                      <motion.div
                        key={index}
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.8 + index * 0.1, type: "spring" }}
                        whileHover={{ scale: 1.05, y: -2 }}
                        className="bg-white bg-opacity-15 backdrop-blur-sm rounded-md sm:rounded-lg px-2 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-medium border border-white border-opacity-20 cursor-pointer"
                      >
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 + index * 0.1 }}>
                          ✓ {feature}
                        </motion.span>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : null}

                {/* Price */}
                {currentSlideData.price && (
                  <motion.div
                    initial={{ y: 20, opacity: 0, scale: 0.8 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8, type: "spring" }}
                    className="flex items-center space-x-2 sm:space-x-4 flex-wrap"
                  >
                    <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-md sm:rounded-lg px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 border border-white border-opacity-30 relative overflow-hidden">
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 opacity-20"
                        animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.3, 0.1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <div className="flex items-center space-x-2 sm:space-x-3 relative z-10 flex-wrap">
                        <motion.span className="text-lg sm:text-xl md:text-2xl font-bold" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                          ₹{currentSlideData.price.discounted.toLocaleString()}
                        </motion.span>
                        <span className="text-xs sm:text-sm line-through opacity-75">
                          ₹{currentSlideData.price.original.toLocaleString()}
                        </span>
                        <motion.div
                          className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full flex items-center"
                          animate={{ 
                            scale: [1, 1.1, 1],
                            boxShadow: ["0 0 0 rgba(239, 68, 68, 0)", "0 0 20px rgba(239, 68, 68, 0.5)", "0 0 0 rgba(239, 68, 68, 0)"]
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Percent className="h-2 w-2 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                          {currentSlideData.price.discount}% OFF
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* CTA */}
                <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.9 }} className="pt-2 sm:pt-4">
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-white text-gray-900 px-4 py-2 sm:px-6 sm:py-3 md:px-8 md:py-4 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base md:text-lg shadow-lg hover:shadow-xl transition-all duration-300 inline-flex items-center space-x-2 sm:space-x-3 relative overflow-hidden group w-full sm:w-auto justify-center"
                    onClick={() => (window.location.href = currentSlideData.buttonLink)}
                    aria-label={currentSlideData.buttonText}
                  >
                    <motion.div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-10" animate={{ x: [-100, 100] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
                    <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                      <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
                    </motion.div>
                    <span>{currentSlideData.buttonText}</span>
                  </motion.button>
                </motion.div>
              </motion.div>

              {/* Image Side */}
              <motion.div
                initial={{ x: 50, opacity: 0, scale: 0.8 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: 30, opacity: 0 }}
                transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                className="relative flex justify-center items-center order-first lg:order-last py-4 sm:py-8 lg:py-0"
              >
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360, scale: [1, 1.2, 1], y: [0, -10, 0] }}
                    transition={{ rotate: { duration: 20, repeat: Infinity, ease: "linear" }, scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }, y: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
                    className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 md:-top-8 md:-right-8 lg:-top-10 lg:-right-10 w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white border-opacity-30 shadow-2xl"
                  >
                    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                      <Gift className="h-4 w-4 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                    </motion.div>
                  </motion.div>

                  <motion.div
                    animate={{ y: [-8, 8, -8], rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -bottom-4 -left-4 sm:-bottom-6 sm:-left-6 md:-bottom-8 md:-left-8 w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-white bg-opacity-20 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white border-opacity-30 shadow-2xl"
                  >
                    <motion.div animate={{ rotate: [0, 360], scale: [1, 1.3, 1] }} transition={{ rotate: { duration: 3, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity } }}>
                      <Zap className="h-3 w-3 sm:h-4 sm:w-4 md:h-6 md:w-6 text-white" />
                    </motion.div>
                  </motion.div>

                  {[...Array(4)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute text-white opacity-40 sm:opacity-60 hidden sm:block"
                      style={{ left: `${20 + Math.random() * 60}%`, top: `${20 + Math.random() * 60}%` }}
                      animate={{ y: [0, -15, 0], rotate: [0, 360], scale: [0.5, 1, 0.5], opacity: [0.2, 0.6, 0.2] }}
                      transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2, ease: "easeInOut" }}
                    >
                      <Star className="h-2 w-2 sm:h-3 sm:w-3 md:h-4 md:w-4" />
                    </motion.div>
                  ))}

                  <div className="relative">
                    <motion.div
                      className="w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl sm:shadow-2xl transform rotate-2 sm:rotate-3 hover:rotate-0 transition-transform duration-500 relative"
                      whileHover={{ scale: 1.02, rotateY: 2, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
                      animate={{ y: [0, -5, 0] }}
                      transition={{ y: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
                    >
                      <motion.img
                        src={currentSlideData.image}
                        alt={currentSlideData.title}
                        className="w-full h-full object-cover"
                        initial={{ scale: 1.1 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-20 sm:opacity-30"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.2, 0.3] }}
                        transition={{ delay: 0.5 }}
                      />
                    </motion.div>

                    <motion.div
                      className="absolute inset-0 bg-white bg-opacity-10 sm:bg-opacity-20 rounded-2xl sm:rounded-3xl blur-2xl sm:blur-3xl transform scale-105 -z-10"
                      animate={{ scale: [1.05, 1.15, 1.05], opacity: [0.1, 0.3, 0.1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute inset-0 border border-white sm:border-2 rounded-2xl sm:rounded-3xl opacity-20 sm:opacity-30 -z-5"
                      animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0, 0.2] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Arrows */}
      <motion.button
        onClick={prevSlide}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 text-white p-2 sm:p-3 rounded-full border border-white border-opacity-30 transition-all duration-200 z-10 shadow-lg"
      >
        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
      </motion.button>
      <motion.button
        onClick={nextSlide}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 text-white p-2 sm:p-3 rounded-full border border-white border-opacity-30 transition-all duration-200 z-10 shadow-lg"
      >
        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
      </motion.button>

      {/* Dots */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2 sm:space-x-3 z-10">
        {promoSlides.map((_, index) => (
          <motion.button
            key={index}
            onClick={() => goToSlide(index)}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${
              currentSlide === index ? 'bg-white scale-110 sm:scale-125 shadow-lg' : 'bg-white bg-opacity-50 hover:bg-opacity-75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 w-full h-0.5 sm:h-1 bg-white bg-opacity-20">
        <motion.div
          className="h-full bg-gradient-to-r from-white via-blue-200 to-white"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 5, ease: "linear", repeat: Infinity }}
        />
      </div>
    </section>
  );
};

export default PromoSlider;
