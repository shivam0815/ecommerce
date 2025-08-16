import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRight, Star, ShoppingBag, Users, Award, 
  Play, Shield, Truck, Headphones, ChevronLeft, 
  ChevronRight, Quote, Instagram, Twitter, Facebook 
} from 'lucide-react';
import HeroSlider from '../components/Layout/HeroSlider';
import PromoSlider from '../components/Layout/PromoSlider';
const Home: React.FC = () => {
  const navigate = useNavigate();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const categories = [
    {
      id: 'bluetooth-neckband',
      name: 'Bluetooth Neckband',
      icon: '🎧',
      gradient: 'from-blue-500 to-purple-500',
      description: 'Premium wireless neckbands',
      color: 'bg-blue-500'
    },
    {
      id: 'true-wireless-stereo',
      name: 'True Wireless Stereo',
      icon: '🎵',
      gradient: 'from-purple-500 to-pink-500',
      description: 'High-quality TWS earbuds',
      color: 'bg-purple-500'
    },
    {
      id: 'data-cable',
      name: 'Data Cable',
      icon: '🔌',
      gradient: 'from-green-500 to-teal-500',
      description: 'Fast charging & sync cables',
      color: 'bg-green-500'
    },
    {
      id: 'mobile-charger',
      name: 'Mobile Charger',
      icon: '⚡',
      gradient: 'from-yellow-500 to-orange-500',
      description: 'Quick & safe charging solutions',
      color: 'bg-yellow-500'
    },
    {
      id: 'mobile-ic',
      name: 'Mobile IC',
      icon: '🔧',
      gradient: 'from-red-500 to-rose-500',
      description: 'Integrated circuits & components',
      color: 'bg-red-500'
    },
    {
      id: 'mobile-repairing-tools',
      name: 'Mobile Repairing Tools',
      icon: '🛠️',
      gradient: 'from-indigo-500 to-blue-500',
      description: 'Professional repair toolkit',
      color: 'bg-indigo-500'
    },
    {
      id: 'car-charger',
      name: 'Car Charger',
      icon: '🚗',
      gradient: 'from-gray-600 to-gray-800',
      description: 'On-the-go charging solutions',
      color: 'bg-gray-600'
    }
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Tech Enthusiast",
      content: "Amazing quality products! The TWS earbuds I bought exceeded my expectations. Crystal clear sound and perfect fit.",
      rating: 5,
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
    },
    {
      name: "Mike Chen",
      role: "Mobile Repair Shop Owner",
      content: "Their repair tools are professional grade. I've been using them for 2 years and they're still like new. Highly recommended!",
      rating: 5,
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
    },
    {
      name: "Priya Sharma",
      role: "Business Owner",
      content: "Excellent OEM services. They delivered 1000+ custom branded chargers on time with perfect quality. Great team!",
      rating: 5,
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face"
    }
  ];

 

  const benefits = [
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Quality Guaranteed",
      description: "All products come with manufacturer warranty and quality assurance"
    },
    {
      icon: <Truck className="h-8 w-8" />,
      title: "Fast Delivery",
      description: "Quick delivery across India with real-time tracking"
    },
    {
      icon: <Headphones className="h-8 w-8" />,
      title: "Expert Support",
      description: "24/7 customer support from our technical experts"
    },
    {
      icon: <Award className="h-8 w-8" />,
      title: "Best Prices",
      description: "Competitive wholesale prices with bulk discounts"
    }
  ];

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/products?category=${categoryId}`);
  };

  return (
    <div className="min-h-screen">
      {/* 🔥 Top Promotional Banner Section */}
      <HeroSlider/>
      
      {/* Enhanced Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 text-white overflow-hidden">
        {/* Animated Background Particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-20"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [-20, -100, -20],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
        
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-block bg-yellow-400 text-gray-900 px-4 py-2 rounded-full text-sm font-semibold mb-6"
              >
                ✨ Trusted by 5000+ Customers
              </motion.div>
              
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                Premium Mobile
                <span className="block text-yellow-400">Accessories</span>
              </h1>
              <p className="text-xl mb-8 text-gray-200">
                Discover our extensive range of high-quality mobile accessories, 
                from TWS earbuds to professional repair tools. Quality guaranteed, 
                prices unmatched.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link
                  to="/products"
                  className="bg-yellow-400 text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-yellow-300 transition-colors duration-200 text-center flex items-center justify-center"
                >
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Shop Now
                </Link>
                <Link
                  to="/oem"
                  className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-gray-900 transition-colors duration-200 text-center"
                >
                  OEM Services
                </Link>
              </div>

              {/* Social Proof */}
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center">
                  <div className="flex -space-x-2 mr-2">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full bg-yellow-400 border-2 border-white"></div>
                    ))}
                  </div>
                  <span>Join 5000+ Happy Customers</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="relative z-10">
                <img
                  src="/mix1.png"
                  alt="Mobile Accessories"
                  className="rounded-lg shadow-2xl"
                />
                {/* Floating Play Button for Video */}
                <motion.button
                  className="absolute inset-0 flex items-center justify-center"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full p-6 border border-white border-opacity-30">
                    <Play className="h-8 w-8 text-white ml-1" />
                  </div>
                </motion.button>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-blue-600 to-transparent rounded-lg transform rotate-3"></div>
            </motion.div>
          </div>
        </div>
      </section>

    

      {/* Enhanced Stats Section */}
      <section className="py-16 bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: ShoppingBag, value: '10,000+', label: 'Products Sold', color: 'from-blue-500 to-blue-600' },
              { icon: Users, value: '5,000+', label: 'Happy Customers', color: 'from-green-500 to-green-600' },
              { icon: Star, value: '4.8/5', label: 'Average Rating', color: 'from-yellow-500 to-yellow-600' },
              { icon: Award, value: '5 Years', label: 'Experience', color: 'from-purple-500 to-purple-600' }
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center group"
              >
                <div className={`bg-gradient-to-r ${stat.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-shadow duration-300`}>
                  <stat.icon className="h-8 w-8 text-white" />
                </div>
                <motion.h3 
                  className="text-3xl font-bold text-gray-900 mb-2"
                  initial={{ scale: 1 }}
                  whileInView={{ scale: [1, 1.1, 1] }}
                  transition={{ delay: index * 0.1 + 0.5, duration: 0.5 }}
                >
                  {stat.value}
                </motion.h3>
                <p className="text-gray-600">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Fixed Categories Section with Working Navigation */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Shop by Category</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Browse our comprehensive collection of mobile accessories organized by category
            </p>
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
                <div className={`
                  relative bg-white rounded-xl p-6 shadow-lg transition-all duration-300
                  ${hoveredCategory === category.id 
                    ? 'transform -translate-y-2 shadow-2xl' 
                    : 'hover:shadow-xl'
                  }
                  border border-gray-200 overflow-hidden
                `}>
                  
                  <div className={`
                    absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 
                    transition-opacity duration-300
                    ${hoveredCategory === category.id ? 'opacity-10' : 'group-hover:opacity-5'}
                  `}></div>

                  <div className={`
                    relative text-4xl mb-4 transition-transform duration-300
                    ${hoveredCategory === category.id ? 'scale-110' : 'group-hover:scale-105'}
                  `}>
                    {category.icon}
                  </div>

                  <h3 className={`
                    relative text-lg font-semibold mb-2 transition-colors duration-300
                    ${hoveredCategory === category.id 
                      ? 'text-transparent bg-clip-text bg-gradient-to-r ' + category.gradient
                      : 'text-gray-900 group-hover:text-gray-700'
                    }
                  `}>
                    {category.name}
                  </h3>

                  <p className="relative text-sm text-gray-600 mb-4">
                    {category.description}
                  </p>

                  {/* Fixed Explore Button with proper click handler */}
                  <button
                    onClick={() => handleCategoryClick(category.id)}
                    className={`
                      relative inline-flex items-center text-sm font-medium transition-all duration-300
                      ${hoveredCategory === category.id
                        ? `text-white bg-gradient-to-r ${category.gradient} px-3 py-1 rounded-md`
                        : 'text-blue-600 group-hover:text-blue-700'
                      }
                    `}
                  >
                    Explore
                    <ArrowRight className={`
                      ml-1 w-4 h-4 transition-transform duration-300
                      ${hoveredCategory === category.id ? 'translate-x-1' : ''}
                    `} />
                  </button>

                  <div className={`
                    absolute top-0 right-0 w-20 h-20 ${category.color} opacity-10 rounded-full 
                    transform translate-x-8 -translate-y-8 transition-all duration-300
                    ${hoveredCategory === category.id ? 'scale-150 opacity-20' : ''}
                  `}></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

<PromoSlider />
      

      {/* Why Choose Us Section */}
      <section className="py-16 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-3xl font-bold mb-4">Why Choose Us?</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              We're committed to providing the best mobile accessories and services in the industry
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center group"
              >
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

      {/* Customer Testimonials */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
            <p className="text-gray-600">Real feedback from real customers</p>
          </motion.div>

          <div className="relative max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-8 shadow-xl">
              <motion.div
                key={currentTestimonial}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="text-center"
              >
                <Quote className="h-12 w-12 text-blue-500 mx-auto mb-6" />
                <p className="text-xl text-gray-700 mb-6 italic">
                  "{testimonials[currentTestimonial].content}"
                </p>
                <div className="flex items-center justify-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <div className="flex items-center justify-center">
                  <img
                    src={testimonials[currentTestimonial].image}
                    alt={testimonials[currentTestimonial].name}
                    className="w-12 h-12 rounded-full mr-4"
                  />
                  <div>
                    <h4 className="font-semibold text-gray-900">{testimonials[currentTestimonial].name}</h4>
                    <p className="text-gray-500">{testimonials[currentTestimonial].role}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Navigation Buttons */}
            <button
              onClick={() => setCurrentTestimonial(prev => prev === 0 ? testimonials.length - 1 : prev - 1)}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-shadow"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <button
              onClick={() => setCurrentTestimonial(prev => (prev + 1) % testimonials.length)}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-shadow"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>

            {/* Indicators */}
            <div className="flex justify-center mt-8 space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    currentTestimonial === index ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Products</h2>
              <p className="text-gray-600">
                Discover our top-rated products loved by customers
              </p>
            </div>
            <Link
              to="/products"   
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-semibold group"
            >
              <span>View All</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Featured products will be loaded dynamically from API */}
          </div>
        </div>
      </section>
      
      {/* Enhanced OEM Services CTA */}
      <section className="py-16 bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              className="inline-block bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-6 py-2 mb-6"
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-sm font-semibold">🏭 OEM Services Available</span>
            </motion.div>
            
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Need Bulk Orders or Custom Branding?
            </h2>
            <p className="text-xl mb-8 max-w-3xl mx-auto">
              We provide comprehensive OEM services including bulk manufacturing, 
              custom branding, and specialized packaging solutions for businesses.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/oem"
                className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-200 inline-flex items-center justify-center"
              >
                <span>Learn More</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-gray-900 transition-colors duration-200">
                Get Quote
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-gray-900 to-black rounded-2xl p-8 md:p-12 text-center text-white relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 transform rotate-12 scale-150"></div>
            </div>
            
            <div className="relative">
              <h2 className="text-3xl font-bold mb-4">Stay Updated with Latest Trends</h2>
              <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
                Subscribe to our newsletter and be the first to know about new products, 
                exclusive deals, and industry insights.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <motion.button 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-colors duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Subscribe
                </motion.button>
              </div>
              
              {/* Social Media Links */}
              <div className="flex justify-center space-x-4 mt-8">
                <motion.a href="#" whileHover={{ scale: 1.1 }} className="text-gray-400 hover:text-white">
                  <Facebook className="h-6 w-6" />
                </motion.a>
                <motion.a href="#" whileHover={{ scale: 1.1 }} className="text-gray-400 hover:text-white">
                  <Twitter className="h-6 w-6" />
                </motion.a>
                <motion.a href="#" whileHover={{ scale: 1.1 }} className="text-gray-400 hover:text-white">
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
