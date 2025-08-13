import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const DashboardHeader = ({ 
  onDateRangeChange, 
  onCurrencyChange, 
  onRefreshIntervalChange,
  currentDateRange = 'week',
  currentCurrency = 'INR',
  currentRefreshInterval = 15,
  lastUpdated = new Date()
}) => {
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const currencyOptions = [
    { value: 'INR', label: '₹ INR' },
    { value: 'USD', label: '$ USD' },
    { value: 'EUR', label: '€ EUR' }
  ];

  const refreshIntervalOptions = [
    { value: 5, label: '5 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' }
  ];

  const formatLastUpdated = () => {
    const now = new Date();
    const diff = Math.floor((now - new Date(lastUpdated)) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const handleManualRefresh = () => {
    // Trigger manual refresh
    console.log('Manual refresh triggered');
  };

  const toggleAutoRefresh = () => {
    setIsAutoRefresh(!isAutoRefresh);
  };

  return (
    <div className="bg-card border-b border-border p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        {/* Title Section */}
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Executive Overview</h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive business performance dashboard
            </p>
          </div>
          
          {/* Live Status Indicator */}
          <div className="flex items-center space-x-2 px-3 py-1 bg-success/10 rounded-full">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-success">Live</span>
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          {/* Date Range Selector */}
          <div className="flex items-center space-x-2">
            <Icon name="Calendar" size={16} className="text-muted-foreground" />
            <Select
              options={dateRangeOptions}
              value={currentDateRange}
              onChange={onDateRangeChange}
              className="w-40"
            />
          </div>

          {/* Currency Selector */}
          <div className="flex items-center space-x-2">
            <Icon name="DollarSign" size={16} className="text-muted-foreground" />
            <Select
              options={currencyOptions}
              value={currentCurrency}
              onChange={onCurrencyChange}
              className="w-24"
            />
          </div>

          {/* Refresh Controls */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 px-3 py-2 bg-muted rounded-lg">
              <Icon name="Clock" size={14} className="text-muted-foreground" />
              <Select
                options={refreshIntervalOptions}
                value={currentRefreshInterval}
                onChange={onRefreshIntervalChange}
                className="w-32"
              />
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAutoRefresh}
              className={isAutoRefresh ? 'border-primary text-primary' : ''}
            >
              <Icon name={isAutoRefresh ? "Pause" : "Play"} size={14} />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
            >
              <Icon name="RefreshCw" size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* Last Updated Info */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center space-x-4">
          <span>Last updated: {formatLastUpdated()}</span>
          <span>•</span>
          <span>Auto-refresh: {isAutoRefresh ? 'On' : 'Off'}</span>
          {isAutoRefresh && (
            <>
              <span>•</span>
              <span>Every {currentRefreshInterval} minutes</span>
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Icon name="Database" size={12} />
          <span>Real-time data</span>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;