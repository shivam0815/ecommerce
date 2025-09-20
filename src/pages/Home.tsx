// src/pages/Home.tsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Star, ShoppingBag, Users, Award,
  Play, Shield, Truck, Headphones,
  ChevronLeft, ChevronRight, Quote,
  Instagram, Twitter, Facebook, Sparkles, Flame, Clock,
  Factory, Package, BadgeCheck, Boxes, Wrench, Globe, Phone, DollarSign,IndianRupee
} from 'lucide-react';
import HeroSlider from '../components/Layout/HeroSlider';
import PromoSlider from '../components/Layout/PromoSlider';
import SEO from '../components/Layout/SEO';
import { newsletterService } from '../services/newsletterService';
import toast from 'react-hot-toast';

import { useTranslation } from 'react-i18next';
import { resolveImageUrl, getFirstImageUrl } from '../utils/imageUtils';

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(e.trim());
const API_BASE = (import.meta as any).env?.VITE_API_URL || 'https://nakodamobile.in/api';

type Product = {
  _id: string;
  name: string;
  slug?: string;
  price: number;
  originalPrice?: number;
  images?: string[];
  imageUrl?: string;
  rating?: number;
  category?: string;
  status?: string;
};

const priceOffPct = (price?: number, original?: number) => {
  if (!price || !original || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // Newsletter state
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [company, setCompany] = useState(''); // honeypot

  // Product strips state
  const [hot, setHot] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [loadingHot, setLoadingHot] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);
  const [errHot, setErrHot] = useState('');
  const [errNew, setErrNew] = useState('');

  const categories = [
    { id: 'bluetooth-neckband', name: 'Bluetooth Neckband', icon: '🎧', gradient: 'from-blue-500 to-purple-500', description: 'Premium wireless neckbands', color: 'bg-blue-500' },
    { id: 'true-wireless-stereo', name: 'True Wireless Stereo', icon: '🎵', gradient: 'from-purple-500 to-pink-500', description: 'High-quality TWS earbuds', color: 'bg-purple-500' },
    { id: 'data-cable', name: 'Data Cable', icon: '🔌', gradient: 'from-green-500 to-teal-500', description: 'Fast charging & sync cables', color: 'bg-green-500' },
    { id: 'Wall-charger', name: 'Wall Charger', icon: '⚡', gradient: 'from-yellow-500 to-orange-500', description: 'Quick & safe charging solutions', color: 'bg-yellow-500' },
    { id: 'car-charger', name: 'Car Charger', icon: '🚗', gradient: 'from-gray-600 to-gray-800', description: 'On-the-go charging solutions', color: 'bg-gray-600' },
    { id: 'mobile-ic', name: 'Mobile IC', icon: '🔧', gradient: 'from-red-500 to-rose-500', description: 'Integrated circuits & Semi-Conductor', color: 'bg-red-500' },
    { id: 'mobile-repairing-tools', name: 'Mobile Repairing Tools', icon: '🛠️', gradient: 'from-indigo-500 to-blue-500', description: 'Professional repair toolkit', color: 'bg-indigo-500' },
    
  ];

  const testimonials = [
    { name: "Saransh", role: "Tech Enthusiast", content: "Amazing quality products! The TWS earbuds I bought exceeded my expectations. Crystal clear sound and perfect fit.", rating: 5, image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face" },
    { name: "Mike chen", role: "Mobile Repair Shop Owner", content: "Their repair tools are professional grade. I've been using them for 2 years and they're still like new. Highly recommended!", rating: 5, image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face" },
    { name: "Priya Sharma", role: "Business Owner", content: "Excellent OEM services. They delivered 1000+ custom branded chargers on time with perfect quality. Great team!", rating: 5, image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face" }
  ];

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial(prev => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/products?category=${categoryId}`);
  };

 const productImage = (p: Product) => {
  const base = p.imageUrl ? resolveImageUrl(p.imageUrl) : getFirstImageUrl(p.images);
  return base || undefined;
};

  const goToProduct = (p: Product) => {
    navigate(`/product/${p.slug || p._id}`);
  };

  // Fetch products
  useEffect(() => {
    const loadHot = async () => {
      try {
        setLoadingHot(true);
        setErrHot('');
        const res = await fetch(`${API_BASE}/products?limit=12&sort=trending&status=active`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Failed to load trending products');
        setHot(data.products || data.items || []);
      } catch (e: any) {
        setErrHot(e?.message || 'Could not load products');
      } finally {
        setLoadingHot(false);
      }
    };
    const loadNew = async () => {
      try {
        setLoadingNew(true);
        setErrNew('');
        const res = await fetch(`${API_BASE}/products?limit=8&sort=new&status=active`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Failed to load new arrivals');
        setNewArrivals(data.products || data.items || []);
      } catch (e: any) {
        setErrNew(e?.message || 'Could not load products');
      } finally {
        setLoadingNew(false);
      }
    };
    loadHot();
    loadNew();
  }, []);

  const budget = (hot.length ? hot.filter(p => (p.price ?? 0) <= 599) : []).slice(0, 8);
  const fallbackBudget = hot.slice(0, 8);

  // Newsletter submit
  const handleSubscribe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast.error('Enter a valid email');
      return;
    }
    if (company.trim()) {
      setEmail('');
      setSubscribed(true);
      return;
    }
    try {
      setLoading(true);
      await newsletterService.subscribe(email, 'home-newsletter', 'home');
      setSubscribed(true);
      setEmail('');
      toast.success('Please check your inbox and confirm your subscription.');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Subscription failed. Try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SEO
        title="Home "
        description="Shop OEM/wholesale mobile accessories—TWS, neckbands, chargers, cables, ICs & more."
        canonicalPath="/"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Nakoda Mobile',
          url: 'https://nakodamobile.in',
          logo: 'https://nakodamobile.in/favicon-512.png'
        }}
      />

      {/* 🔥 Top Promotional Banner Section */}
      <HeroSlider />

      {/* Enhanced Stats Section */}
      <section className="py-16 bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: ShoppingBag, value: '1,00,000+', label: 'Products Sold', color: 'from-blue-500 to-blue-600' },
              { icon: Users, value: '50,000+', label: 'Happy Customers', color: 'from-green-500 to-green-600' },
              { icon: Star, value: '4.8/5', label: 'Average Rating', color: 'from-yellow-500 to-yellow-600' },
              { icon: Award, value: '25+Years', label: 'Experience', color: 'from-purple-500 to-purple-600' }
            ].map((stat, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="text-center group">
                <div className={`bg-gradient-to-r ${stat.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-shadow duration-300`}>
                  <stat.icon className="h-8 w-8 text-white" />
                </div>
                <motion.h3 className="text-3xl font-bold text-gray-900 mb-2" initial={{ scale: 1 }} whileInView={{ scale: [1, 1.1, 1] }} transition={{ delay: index * 0.1 + 0.5, duration: 0.5 }}>
                  {stat.value}
                </motion.h3>
                <p className="text-gray-600">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== About Nakoda Mobile + Shop Photos ===================== */}
<section className="py-16 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="mb-10 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-blue-200" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">About Nakoda Mobile</h2>
          <p className="text-blue-100">Built for repair pros. Trusted by businesses.</p>
        </div>
      </div>
      <Link
        to="/about"
        className="text-blue-200 hover:text-white font-semibold"
      >
        Learn more →
      </Link>
    </div>

    {/* Content + Gallery */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
      {/* Left: Copy */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="space-y-4 text-blue-100 leading-relaxed">
       <p className="text-lg">
  <span className="font-semibold text-white">Nakoda Mobile</span> – Trusted Partner for 
  <span className="font-semibold text-white">Accessories & Tools</span>

We supply high-quality mobile accessories — chargers, cables, TWS, neckbands, speakers, power banks & more — built for durability and everyday performance.

For mobile repair shops, we also provide reliable tools, from hand tools to advanced diagnostic equipment.

With strict quality checks and honest pricing, Nakoda Mobile is here to support your growth, not just sell products.
</p>




        </div>

        {/* Quick highlights */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { title: 'Best Quality', desc: 'Tested and Quality Check' },
          { title: 'Best Price', desc: 'Transparent and reliable pricing' },
            { title: 'Fast Delivery', desc: 'Consistent stock & quick dispatch' },
            { title: 'Execellent Support', desc: 'Providing the pre and post support' },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h4 className="font-semibold text-white">{item.title}</h4>
              <p className="text-sm text-blue-100">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Link
            to="/contact"
            className="inline-flex items-center rounded-lg bg-white text-gray-900 px-5 py-3 font-semibold hover:bg-gray-100"
          >
            Contact Us <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
          <Link
            to="/oem"
            className="inline-flex items-center rounded-lg border border-white/30 px-5 py-3 font-semibold hover:bg-white/10 text-white"
          >
            Explore OEM Services
          </Link>
        </div>
      </motion.div>

      {/* Right: Shop Photo Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
       
        {(() => {
          const rawPhotos = [
            // TODO: replace these with your real shop images
            'https://res.cloudinary.com/dt7xwlswy/image/upload/v1757156418/mt9by1kt31odrb8a8f6n.jpg',
            'https://res.cloudinary.com/dt7xwlswy/image/upload/v1757156418/np2btbi9faiktkr9kegy.jpg',
            'https://res.cloudinary.com/dt7xwlswy/image/upload/v1757156422/yexojn2fnpa582ikgntp.jpg',
            'https://res.cloudinary.com/dt7xwlswy/image/upload/v1757156418/chyuw0pubq1nadzyz3lx.jpg',
            'https://res.cloudinary.com/dt7xwlswy/image/upload/v1757156418/hbalmt0icrc8qvpyiody.jpg',
          ];

         const toImg = (url: string) => resolveImageUrl(url);

          return (
            <div className="grid grid-cols-2 gap-3">
              {rawPhotos.map((src, i) => (
                <div
                  key={i}
                  className={`relative overflow-hidden rounded-xl border border-white/10 bg-white/5 ${
                    i === 0 ? 'col-span-2 aspect-[16/9]' : 'aspect-[4/3]'
                  }`}
                >
                  <img
                    loading="lazy"
                    src={toImg(src)}
                    alt={`Nakoda Mobile shop photo ${i + 1}`}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
              ))}
            </div>
          );
        })()}
        <p className="mt-3 text-xs text-blue-200">
          Want a visit or virtual tour? <Link to="/contact" className="underline decoration-blue-300 hover:text-white">Get in touch</Link>.
        </p>
      </motion.div>
    </div>
  </div>
</section>



     

    

      {/* ===================== Services We Offer ===================== */}
     <section className="py-16 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    {/* Section Heading */}
    <motion.div
      className="text-center mb-12"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <h2 className="text-3xl md:text-4xl font-bold mb-3">Services We Offer</h2>
      <p className="text-blue-100 max-w-2xl mx-auto">
        End-to-end OEM solutions—from sourcing to branding, packaging, QC and last-mile delivery.
      </p>
    </motion.div>

    {/* Pyramid Layout 3–2–2 */}
    <div className="space-y-8">
      {/* Row 1: 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { icon: Factory, title: 'OEM & Private Label', desc: 'Custom molds, finishes, and brand identity across SKUs.' },
          { icon: Boxes, title: 'Universal Packaging', desc: 'Universal packaging solutions for consistent shelf presence.' },
          { icon: Shield, title: 'Quality & Compliance', desc: 'Careful quality checks and reliability tests for every product.' },
        ].map((svc, i) => (
          <motion.div
            key={svc.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur hover:bg-white/10 hover:border-white/20 transition"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-white/10 p-3">
                <svc.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{svc.title}</h3>
                <p className="text-sm text-blue-100 mt-1">{svc.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Row 2: 2 cards */}
      <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-2 gap-6 lg:justify-items-center">
        {[
          { icon: Truck, title: 'Fulfilment & Logistics', desc: 'Pan-India shipping, tracking, and B2B dispatch workflows.' },
          { icon: Wrench, title: 'After-Sales & Support', desc: 'Damage checks, spare availability, and ongoing support for smooth operations.' },
        ].map((svc, i) => (
          <motion.div
            key={svc.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: (i + 3) * 0.05 }}
            className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur hover:bg-white/10 hover:border-white/20 transition"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-white/10 p-3">
                <svc.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{svc.title}</h3>
                <p className="text-sm text-blue-100 mt-1">{svc.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Row 3: 2 cards */}
      <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-2 gap-6 lg:justify-items-center">
        {[
          { icon: Globe, title: 'Imported From China', desc: 'Factory tie-ups and thorough product testing before import.' },
          { icon: IndianRupee, title: 'B2B Pricing', desc: 'Flexible wholesale pricing with credit options for businesses.' },
        ].map((svc, i) => (
          <motion.div
            key={svc.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: (i + 5) * 0.05 }}
            className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur hover:bg-white/10 hover:border-white/20 transition"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-white/10 p-3">
                <svc.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{svc.title}</h3>
                <p className="text-sm text-blue-100 mt-1">{svc.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>

    {/* CTA Buttons */}
    <div className="text-center mt-12">
      <div className="inline-flex flex-col sm:flex-row gap-3">
        <Link
          to="/oem"
          className="rounded-lg bg-white text-gray-900 px-6 py-3 font-semibold hover:bg-gray-100 inline-flex items-center justify-center"
        >
          Explore OEM <ArrowRight className="ml-2 w-4 h-4" />
        </Link>
        <Link
          to="/contact"
          className="rounded-lg border border-white/30 px-6 py-3 font-semibold hover:bg-white/10 inline-flex items-center justify-center text-white"
        >
          Contact Sales
        </Link>
      </div>
    </div>
  </div>
</section>

      {/* ===================== /Services ===================== */}

      {/* Categories */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Shop by Category</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Browse our comprehensive collection of mobile accessories organized by category</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="group cursor-pointer"
                onMouseEnter={() => setHoveredCategory(category.id)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <div
                  className={`relative bg-white rounded-xl p-6 shadow-lg transition-all duration-300
                  ${hoveredCategory === category.id ? 'transform -translate-y-2 shadow-2xl' : 'hover:shadow-xl'}
                  border border-gray-200 overflow-hidden`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 transition-opacity duration-300
                    ${hoveredCategory === category.id ? 'opacity-10' : 'group-hover:opacity-5'}`} />
                  <div className={`relative text-4xl mb-4 transition-transform duration-300
                    ${hoveredCategory === category.id ? 'scale-110' : 'group-hover:scale-105'}`}>
                    {category.icon}
                  </div>
                  <h3
                    className={`relative text-lg font-semibold mb-2 transition-colors duration-300
                    ${hoveredCategory === category.id ? 'text-transparent bg-clip-text bg-gradient-to-r ' + category.gradient : 'text-gray-900 group-hover:text-gray-700'}`}
                  >
                    {category.name}
                  </h3>
                  <p className="relative text-sm text-gray-600 mb-4">{category.description}</p>
                  <button
                    onClick={() => handleCategoryClick(category.id)}
                    className={`relative inline-flex items-center text-sm font-medium transition-all duration-300
                      ${hoveredCategory === category.id ? `text-white bg-gradient-to-r ${category.gradient} px-3 py-1 rounded-md` : 'text-blue-600 group-hover:text-blue-700'}`}
                  >
                    Explore
                    <ArrowRight className={`ml-1 w-4 h-4 transition-transform duration-300 ${hoveredCategory === category.id ? 'translate-x-1' : ''}`} />
                  </button>
                  <div className={`absolute top-0 right-0 w-20 h-20 ${category.color} opacity-10 rounded-full transform translate-x-8 -translate-y-8 transition-all duration-300 ${hoveredCategory === category.id ? 'scale-150 opacity-20' : ''}`} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <PromoSlider />

      {/* Why Choose Us */}
      <section className="py-16 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}>
            <h2 className="text-3xl font-bold mb-4">Why Choose Us?</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">We're committed to providing the best mobile accessories and services in the industry</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <Shield className="h-8 w-8" />, title: "Quality Guaranteed", description: "Every product is quality-checked and supported with counter warranty approval." },
              { icon: <Truck className="h-8 w-8" />, title: "Fast Delivery", description: "Quick delivery across India with real-time tracking" },
              { icon: <Headphones className="h-8 w-8" />, title: "Expert Support", description: " customer support from our technical experts" },
              { icon: <Award className="h-8 w-8" />, title: "Best Prices", description: "Competitive wholesale prices with bulk discounts" }
            ].map((benefit, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="text-center group">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-semibold mb-4">{benefit.title}</h3>
                <p className="text-gray-300">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== Try Samples ===================== */}
<section className="py-16 bg-white">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="mb-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Try Samples</h2>
          <p className="text-gray-600">Test quality before bulk—quick dispatch for verified B2B buyers</p>
        </div>
      </div>
      <Link
  to="/samples"   // ← CHANGE
  className="text-indigo-600 hover:text-indigo-700 font-semibold"
>
  Request custom sample →
</Link>

    </div>

    {(() => {
      // Build a 4–5 product sample set (prefer cheapest first)
      const merged: Product[] = Array.from(
        new Map(
          [...newArrivals, ...hot].map((p) => [p._id, p]) // de-dup
        ).values()
      );

      const pick = merged
        .filter((p) => typeof p.price === 'number' && (p.status ?? 'active') === 'active')
        .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
        .slice(0, 5);

      const fallback = (hot.length ? hot : newArrivals).slice(0, 5);
      const samples = pick.length ? pick : fallback;

      if ((loadingHot || loadingNew) && samples.length === 0) {
        // Skeletons
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white border border-gray-200 p-4">
                <div className="h-40 w-full rounded-lg bg-gray-100 animate-pulse" />
                <div className="mt-4 h-5 w-3/4 bg-gray-100 rounded animate-pulse" />
                <div className="mt-2 h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
                <div className="mt-4 h-9 w-full bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        );
      }

      if (!samples.length) {
        return <div className="text-sm text-gray-600">Samples will appear here soon.</div>;
      }

      const sampleLink = (p: Product) =>
  `/product/${encodeURIComponent(p.slug || p._id)}?sample=1`;  // ← CHANGE


      return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {samples.map((p) => {
            const img = productImage(p);
            return (
              <article
                key={p._id}
                className="group rounded-2xl border border-gray-200 bg-white p-4 hover:shadow-md transition"
              >
                <button
                  onClick={() => goToProduct(p)}
                  className="block w-full overflow-hidden rounded-xl bg-gray-50"
                  aria-label={p.name}
                >
                  {img ? (
                    <img
                      src={img}
                      alt={p.name}
                      className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-40 w-full bg-gray-100" />
                  )}
                </button>

                <div className="mt-3">
                  <h3 className="line-clamp-2 font-semibold text-gray-900">{p.name}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="text-indigo-700 font-bold">₹{p.price?.toLocaleString()}</div>
                    {p.originalPrice && p.originalPrice > p.price && (
                      <div className="text-gray-400 line-through">₹{p.originalPrice.toLocaleString()}</div>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <Link
                      to={sampleLink(p)}
                      className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white text-center hover:bg-black"
                    >
                      Request Sample
                    </Link>
                    <Link
                      to={`/product/${p.slug || p._id}`}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 text-center"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      );
    })()}
  </div>
</section>
{/* ===================== /Try Samples ===================== */}


      {/* Testimonials */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
            <p className="text-gray-600">Real feedback from real customers</p>
          </motion.div>

          <div className="relative max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-8 shadow-xl">
              <motion.div key={currentTestimonial} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="text-center">
                <Quote className="h-12 w-12 text-blue-500 mx-auto mb-6" />
                <p className="text-xl text-gray-700 mb-6 italic">"{testimonials[currentTestimonial].content}"</p>
                <div className="flex items-center justify-center mb-4">
                  {[...Array(5)].map((_, i) => (<Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />))}
                </div>
                <div className="flex items-center justify-center">
                  <img src={testimonials[currentTestimonial].image} alt={testimonials[currentTestimonial].name} className="w-12 h-12 rounded-full mr-4" />
                  <div>
                    <h4 className="font-semibold text-gray-900">{testimonials[currentTestimonial].name}</h4>
                    <p className="text-gray-500">{testimonials[currentTestimonial].role}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            <button onClick={() => setCurrentTestimonial(prev => prev === 0 ? testimonials.length - 1 : prev - 1)} className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-shadow">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <button onClick={() => setCurrentTestimonial(prev => (prev + 1) % testimonials.length)} className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-shadow">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>

            <div className="flex justify-center mt-8 space-x-2">
              {testimonials.map((_, index) => (
                <button key={index} onClick={() => setCurrentTestimonial(index)} className={`w-3 h-3 rounded-full transition-colors ${currentTestimonial === index ? 'bg-blue-500' : 'bg-gray-300'}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* OEM CTA */}
      <section className="py-16 bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <motion.div className="inline-block bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-6 py-2 mb-6" whileHover={{ scale: 1.05 }}>
              <span className="text-sm font-semibold">🏭 OEM Services Available</span>
            </motion.div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Need Bulk Orders or Custom Branding?</h2>
            <p className="text-xl mb-8 max-w-3xl mx-auto">We provide comprehensive OEM services including bulk manufacturing, custom branding, and  packaging solutions for businesses.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/oem" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-200 inline-flex items-center justify-center">
                <span>Learn More</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link to="/oem#contact-form" className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-gray-900 transition-colors duration-200">
                Get Quote
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-gray-900 to-black rounded-2xl p-8 md:p-12 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 transform rotate-12 scale-150"></div>
            </div>

            <div className="relative">
              <h2 className="text-3xl font-bold mb-4">Stay Updated with Latest Trends</h2>
              <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
                Subscribe to our newsletter and be the first to know about new products, exclusive deals, and industry insights.
              </p>

              {subscribed && (
                <div className="max-w-md mx-auto mb-4 text-sm bg-green-600/20 text-green-200 border border-green-400/40 rounded-md px-4 py-3">
                  🎉 Thanks! Please check your email and click the confirmation link to finish subscribing.
                </div>
              )}

              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto" noValidate>
                {/* Honeypot */}
                <input
                  type="text"
                  name="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                />

                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
                  aria-label="Email address"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
                <motion.button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-colors duration-200 disabled:opacity-60"
                  whileHover={{ scale: loading ? 1 : 1.05 }}
                  whileTap={{ scale: loading ? 1 : 0.95 }}
                  disabled={loading}
                >
                  {loading ? 'Subscribing…' : 'Subscribe'}
                </motion.button>
              </form>

              <p className="text-xs text-gray-400 mt-3">
                By subscribing, you agree to our{' '}
                <Link to="/privacy" className="underline hover:text-gray-200">Privacy Policy</Link>.
                You can unsubscribe at any time.
              </p>

              <div className="flex justify-center space-x-4 mt-8">
                <motion.a href="https://www.facebook.com/jitendra.kothari.121/" whileHover={{ scale: 1.1 }} className="text-gray-400 hover:text-white" rel="noreferrer" aria-label="Facebook">
                  <Facebook className="h-6 w-6" />
                </motion.a>
                <motion.a href="https://x.com/_nakodamobile_?t=yJpXFZwym_u7fbB_3ORckQ&s=08" whileHover={{ scale: 1.1 }} className="text-gray-400 hover:text-white" rel="noreferrer" aria-label="Twitter">
                  <Twitter className="h-6 w-6" />
                </motion.a>
                <motion.a href="https://www.instagram.com/v2m_nakoda_mobile/" whileHover={{ scale: 1.1 }} className="text-gray-400 hover:text-white" rel="noreferrer" aria-label="Instagram">
                  <Instagram className="h-6 w-6" />
                </motion.a>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
