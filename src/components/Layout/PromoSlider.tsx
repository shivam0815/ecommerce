import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingBag, Sparkles, Percent } from 'lucide-react';

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

  const promoSlides: PromoSlide[] = [
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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % promoSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [promoSlides.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % promoSlides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + promoSlides.length) % promoSlides.length);
  const goToSlide = (index: number) => setCurrentSlide(index);

  const s = promoSlides[currentSlide];

  return (
    <section className="relative h-[400px] sm:h-[500px] md:h-[600px] lg:h-[650px] xl:h-[700px] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`absolute inset-0 bg-gradient-to-r ${s.backgroundGradient}`}
        >
          {/* subtle dotted bg only */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_white_1px,_transparent_1px)] bg-[length:20px_20px]" />
          </div>

          <div className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 h-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 h-full items-center">
              {/* Text */}
              <div className="text-white space-y-4 md:space-y-6 py-6 lg:py-0">
                {s.badge && (
                  <div className="inline-flex items-center bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/30">
                    <Sparkles className="h-4 w-4 mr-2" />
                    <span className="text-sm font-semibold">{s.badge}</span>
                  </div>
                )}

                <p className="text-base md:text-lg font-medium opacity-90">{s.subtitle}</p>

                <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight">
                  {s.title}
                </h1>

                <p className="text-sm md:text-base lg:text-lg opacity-90 max-w-lg">
                  {s.description}
                </p>

                {s.price && (
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl md:text-3xl font-bold">₹{s.price.discounted.toLocaleString()}</span>
                    <span className="text-sm line-through opacity-75">₹{s.price.original.toLocaleString()}</span>
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full inline-flex items-center">
                      <Percent className="h-3 w-3 mr-1" />
                      {s.price.discount}% OFF
                    </span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    className="bg-white text-gray-900 px-6 py-3 rounded-xl font-bold text-base shadow-lg hover:shadow-xl transition-all inline-flex items-center space-x-2"
                    onClick={() => (window.location.href = s.buttonLink)}
                    aria-label={s.buttonText}
                  >
                    <ShoppingBag className="h-5 w-5" />
                    <span>{s.buttonText}</span>
                  </button>
                </div>
              </div>

              {/* Image — clickable, overlays removed */}
              <a
                href={s.buttonLink}
                aria-label={s.buttonText}
                className="relative flex justify-center items-center order-first lg:order-last py-6 lg:py-0 cursor-pointer"
              >
                <motion.div
                  className="w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  <img
                    src={s.image}
                    alt={s.title}
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </motion.div>
              </a>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Arrows */}
      <motion.button
        onClick={prevSlide}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2 sm:p-3 rounded-full border border-white/30 z-10 shadow-lg"
      >
        <ChevronLeft className="h-5 w-5" />
      </motion.button>
      <motion.button
        onClick={nextSlide}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2 sm:p-3 rounded-full border border-white/30 z-10 shadow-lg"
      >
        <ChevronRight className="h-5 w-5" />
      </motion.button>

      {/* Dots */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex space-x-3 z-10">
        {promoSlides.map((_, i) => (
          <button
            key={i}
            onClick={() => goToSlide(i)}
            className={`w-3 h-3 rounded-full transition-all ${currentSlide === i ? 'bg-white' : 'bg-white/50 hover:bg-white/75'}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
        <motion.div
          className="h-full bg-white"
          key={currentSlide} // reset per slide
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 5, ease: "linear" }}
        />
      </div>
    </section>
  );
};

export default PromoSlider;
