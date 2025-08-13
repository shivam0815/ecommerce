import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';

const NavigationBreadcrumb = ({ filterState = {}, onNavigationBack }) => {
  const location = useLocation();

  const dashboardMap = {
    '/executive-overview-dashboard': {
      title: 'Executive Overview',
      icon: 'BarChart3',
      parent: null
    },
    '/inventory-management-dashboard': {
      title: 'Inventory Management',
      icon: 'Package',
      parent: null
    },
    '/order-fulfillment-analytics-dashboard': {
      title: 'Order Fulfillment Analytics',
      icon: 'ShoppingCart',
      parent: null
    },
    '/revenue-performance-analytics-dashboard': {
      title: 'Revenue Performance Analytics',
      icon: 'TrendingUp',
      parent: null
    }
  };

  const currentDashboard = dashboardMap[location.pathname];
  
  if (!currentDashboard) return null;

  const generateBreadcrumbItems = () => {
    const items = [
      {
        label: 'Dashboard',
        path: '/',
        icon: 'Home'
      },
      {
        label: currentDashboard.title,
        path: location.pathname,
        icon: currentDashboard.icon,
        current: true
      }
    ];

    // Add filter-based breadcrumb items if filters are applied
    if (filterState.dateRange) {
      items.push({
        label: `${filterState.dateRange}`,
        path: null,
        icon: 'Calendar',
        filter: true
      });
    }

    if (filterState.category) {
      items.push({
        label: filterState.category,
        path: null,
        icon: 'Filter',
        filter: true
      });
    }

    if (filterState.drillDown) {
      items.push({
        label: filterState.drillDown,
        path: null,
        icon: 'ZoomIn',
        filter: true
      });
    }

    return items;
  };

  const breadcrumbItems = generateBreadcrumbItems();

  const handleBackNavigation = () => {
    if (onNavigationBack) {
      onNavigationBack();
    } else {
      window.history.back();
    }
  };

  return (
    <div className="flex items-center space-x-2 px-6 py-3 bg-muted/30 border-b border-border text-sm">
      {/* Back Button */}
      {breadcrumbItems.length > 2 && (
        <button
          onClick={handleBackNavigation}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-smooth"
          title="Go back"
        >
          <Icon name="ArrowLeft" size={16} className="text-muted-foreground" />
        </button>
      )}

      {/* Breadcrumb Items */}
      <nav className="flex items-center space-x-2 overflow-x-auto scrollbar-hide">
        {breadcrumbItems.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <Icon 
                name="ChevronRight" 
                size={14} 
                className="text-muted-foreground flex-shrink-0" 
              />
            )}
            
            <div className="flex items-center space-x-1 flex-shrink-0">
              {item.path && !item.current ? (
                <Link
                  to={item.path}
                  className="flex items-center space-x-1 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
                >
                  <Icon name={item.icon} size={14} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              ) : (
                <div className={`flex items-center space-x-1 px-2 py-1 rounded-md ${
                  item.current 
                    ? 'text-foreground bg-background' 
                    : item.filter 
                      ? 'text-primary bg-primary/10' :'text-muted-foreground'
                }`}>
                  <Icon name={item.icon} size={14} />
                  <span className="whitespace-nowrap font-medium">{item.label}</span>
                  
                  {/* Remove filter button */}
                  {item.filter && (
                    <button
                      onClick={() => {
                        // Handle filter removal logic here
                        console.log('Remove filter:', item.label);
                      }}
                      className="ml-1 w-4 h-4 rounded-full hover:bg-primary/20 flex items-center justify-center transition-smooth"
                      title="Remove filter"
                    >
                      <Icon name="X" size={10} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </React.Fragment>
        ))}
      </nav>

      {/* Connection Status Indicator */}
      <div className="ml-auto flex items-center space-x-2">
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse-subtle"></div>
          <span>Live</span>
        </div>
      </div>
    </div>
  );
};

export default NavigationBreadcrumb;