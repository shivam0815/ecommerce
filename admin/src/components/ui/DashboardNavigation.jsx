import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';

const DashboardNavigation = () => {
  const location = useLocation();

  const navigationItems = [
    {
      label: 'Overview',
      path: '/executive-overview-dashboard',
      icon: 'BarChart3',
      description: 'Executive dashboard with comprehensive KPIs and business performance metrics'
    },
    {
      label: 'Inventory',
      path: '/inventory-management-dashboard',
      icon: 'Package',
      description: 'Real-time stock monitoring and warehouse operations analytics'
    },
    {
      label: 'Orders',
      path: '/order-fulfillment-analytics-dashboard',
      icon: 'ShoppingCart',
      description: 'Order processing pipeline and logistics performance tracking'
    },
    {
      label: 'Revenue',
      path: '/revenue-performance-analytics-dashboard',
      icon: 'TrendingUp',
      description: 'Sales analytics and revenue performance insights'
    }
  ];

  const isActivePath = (path) => location.pathname === path;

  return (
    <nav className="sticky top-16 z-40 bg-card border-b border-border">
      <div className="px-6">
        <div className="flex items-center space-x-8 overflow-x-auto scrollbar-hide">
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`group relative flex items-center space-x-2 px-4 py-4 text-sm font-medium whitespace-nowrap transition-smooth ${
                isActivePath(item.path)
                  ? 'text-primary border-b-2 border-primary' :'text-muted-foreground hover:text-foreground border-b-2 border-transparent hover:border-muted'
              }`}
              title={item.description}
            >
              <Icon 
                name={item.icon} 
                size={16} 
                className={isActivePath(item.path) ? 'text-primary' : 'text-current'} 
              />
              <span>{item.label}</span>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-md modal-shadow opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-smooth delay-150 w-64 text-center">
                {item.description}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover"></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default DashboardNavigation;