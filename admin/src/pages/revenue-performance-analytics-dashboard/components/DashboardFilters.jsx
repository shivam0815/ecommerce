import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const DashboardFilters = ({ onFiltersChange }) => {
  const [filters, setFilters] = useState({
    dateRange: '7d',
    comparisonMode: 'period',
    customerSegment: 'all',
    productCategory: 'all',
    channel: 'all',
    campaign: 'all'
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '1y', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const comparisonOptions = [
    { value: 'period', label: 'Period-over-Period' },
    { value: 'year', label: 'Year-over-Year' },
    { value: 'none', label: 'No Comparison' }
  ];

  const customerSegmentOptions = [
    { value: 'all', label: 'All Customers' },
    { value: 'new', label: 'New Customers' },
    { value: 'returning', label: 'Returning Customers' },
    { value: 'vip', label: 'VIP Customers' },
    { value: 'enterprise', label: 'Enterprise' }
  ];

  const productCategoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'smartphones', label: 'Smartphones' },
    { value: 'cases', label: 'Phone Cases' },
    { value: 'chargers', label: 'Chargers & Cables' },
    { value: 'headphones', label: 'Headphones' },
    { value: 'accessories', label: 'Other Accessories' }
  ];

  const channelOptions = [
    { value: 'all', label: 'All Channels' },
    { value: 'online', label: 'Online Store' },
    { value: 'marketplace', label: 'Marketplaces' },
    { value: 'retail', label: 'Retail Partners' },
    { value: 'wholesale', label: 'Wholesale' }
  ];

  const campaignOptions = [
    { value: 'all', label: 'All Campaigns' },
    { value: 'CAMP001', label: 'Summer Mobile Sale' },
    { value: 'CAMP002', label: 'Accessory Bundle Offer' },
    { value: 'CAMP003', label: 'Flash Friday Sale' },
    { value: 'CAMP004', label: 'New Customer Welcome' }
  ];

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
  };

  const resetFilters = () => {
    const defaultFilters = {
      dateRange: '7d',
      comparisonMode: 'period',
      customerSegment: 'all',
      productCategory: 'all',
      channel: 'all',
      campaign: 'all'
    };
    setFilters(defaultFilters);
    if (onFiltersChange) {
      onFiltersChange(defaultFilters);
    }
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => value !== 'all' && value !== 'period' && value !== '7d').length;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 dashboard-shadow mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Icon name="Filter" size={20} className="text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Dashboard Filters</h3>
          {getActiveFiltersCount() > 0 && (
            <span className="px-2 py-1 bg-primary text-primary-foreground rounded-full text-xs font-medium">
              {getActiveFiltersCount()} active
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            iconName="RotateCcw"
          >
            Reset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            iconName={isExpanded ? 'ChevronUp' : 'ChevronDown'}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </div>

      {/* Primary Filters - Always Visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Select
          label="Date Range"
          options={dateRangeOptions}
          value={filters.dateRange}
          onChange={(value) => handleFilterChange('dateRange', value)}
        />
        
        <Select
          label="Comparison Mode"
          options={comparisonOptions}
          value={filters.comparisonMode}
          onChange={(value) => handleFilterChange('comparisonMode', value)}
        />
        
        <Select
          label="Customer Segment"
          options={customerSegmentOptions}
          value={filters.customerSegment}
          onChange={(value) => handleFilterChange('customerSegment', value)}
        />
        
        <Select
          label="Product Category"
          options={productCategoryOptions}
          value={filters.productCategory}
          onChange={(value) => handleFilterChange('productCategory', value)}
        />
      </div>

      {/* Advanced Filters - Collapsible */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-border">
          <Select
            label="Sales Channel"
            options={channelOptions}
            value={filters.channel}
            onChange={(value) => handleFilterChange('channel', value)}
          />
          
          <Select
            label="Campaign"
            options={campaignOptions}
            value={filters.campaign}
            onChange={(value) => handleFilterChange('campaign', value)}
          />
          
          {/* Custom Date Range Inputs */}
          {filters.dateRange === 'custom' && (
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-foreground mb-2">
                Custom Date Range
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  className="flex-1 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  defaultValue="2024-07-01"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  className="flex-1 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  defaultValue="2024-07-30"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Filter Presets */}
      <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border">
        <span className="text-sm font-medium text-muted-foreground mr-2">Quick Presets:</span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            handleFilterChange('dateRange', '30d');
            handleFilterChange('customerSegment', 'new');
          }}
        >
          New Customer Analysis
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            handleFilterChange('dateRange', '7d');
            handleFilterChange('productCategory', 'smartphones');
            handleFilterChange('channel', 'online');
          }}
        >
          Mobile Sales Focus
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            handleFilterChange('comparisonMode', 'year');
            handleFilterChange('dateRange', '90d');
          }}
        >
          Seasonal Comparison
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            handleFilterChange('customerSegment', 'vip');
            handleFilterChange('dateRange', '30d');
          }}
        >
          VIP Performance
        </Button>
      </div>

      {/* Applied Filters Summary */}
      {getActiveFiltersCount() > 0 && (
        <div className="mt-4 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Applied Filters:</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-xs"
            >
              Clear All
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(filters).map(([key, value]) => {
              if (value === 'all' || (key === 'comparisonMode' && value === 'period') || (key === 'dateRange' && value === '7d')) {
                return null;
              }
              
              const getLabel = (key, value) => {
                const optionMaps = {
                  dateRange: dateRangeOptions,
                  comparisonMode: comparisonOptions,
                  customerSegment: customerSegmentOptions,
                  productCategory: productCategoryOptions,
                  channel: channelOptions,
                  campaign: campaignOptions
                };
                
                const option = optionMaps[key]?.find(opt => opt.value === value);
                return option ? option.label : value;
              };
              
              return (
                <span
                  key={key}
                  className="inline-flex items-center space-x-1 px-2 py-1 bg-primary/10 text-primary rounded text-xs"
                >
                  <span>{getLabel(key, value)}</span>
                  <button
                    onClick={() => handleFilterChange(key, key === 'dateRange' ? '7d' : key === 'comparisonMode' ? 'period' : 'all')}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <Icon name="X" size={10} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFilters;