import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navigationItems = [
    { label: 'Overview', path: '/executive-overview-dashboard', icon: 'BarChart3' },
    { label: 'Inventory', path: '/inventory-management-dashboard', icon: 'Package' },
    { label: 'Orders', path: '/order-fulfillment-analytics-dashboard', icon: 'ShoppingCart' },
    { label: 'Revenue', path: '/revenue-performance-analytics-dashboard', icon: 'TrendingUp' }
  ];

  const secondaryItems = [
    { label: 'Settings', path: '/settings', icon: 'Settings' },
    { label: 'Help', path: '/help', icon: 'HelpCircle' },
    { label: 'Admin', path: '/admin', icon: 'Shield' }
  ];

  const isActivePath = (path) => location.pathname === path;

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50 dashboard-shadow">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Icon name="BarChart3" size={20} color="white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-foreground">Nakoda</span>
            <span className="text-xs text-muted-foreground -mt-1">Mobile Analytics</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-8">
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-smooth ${
                isActivePath(item.path)
                  ? 'text-primary bg-primary/10' :'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
            </Link>
          ))}
          
          {/* More Menu */}
          <div className="relative group">
            <Button variant="ghost" size="sm" className="flex items-center space-x-1">
              <Icon name="MoreHorizontal" size={16} />
              <span>More</span>
            </Button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-md modal-shadow opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-smooth">
              {secondaryItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-popover-foreground hover:bg-muted first:rounded-t-md last:rounded-b-md"
                >
                  <Icon name={item.icon} size={16} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* User Actions */}
        <div className="hidden lg:flex items-center space-x-4">
          <Button variant="ghost" size="sm">
            <Icon name="Bell" size={16} />
          </Button>
          <Button variant="ghost" size="sm">
            <Icon name="User" size={16} />
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={toggleMobileMenu}
        >
          <Icon name={isMobileMenuOpen ? "X" : "Menu"} size={20} />
        </Button>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-card border-t border-border">
          <nav className="px-6 py-4 space-y-2">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-3 rounded-md text-sm font-medium transition-smooth ${
                  isActivePath(item.path)
                    ? 'text-primary bg-primary/10' :'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </Link>
            ))}
            
            <div className="border-t border-border pt-2 mt-4">
              {secondaryItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center space-x-3 px-3 py-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
            
            <div className="border-t border-border pt-2 mt-4 flex space-x-2">
              <Button variant="ghost" size="sm" fullWidth>
                <Icon name="Bell" size={16} />
                <span className="ml-2">Notifications</span>
              </Button>
              <Button variant="ghost" size="sm" fullWidth>
                <Icon name="User" size={16} />
                <span className="ml-2">Profile</span>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;