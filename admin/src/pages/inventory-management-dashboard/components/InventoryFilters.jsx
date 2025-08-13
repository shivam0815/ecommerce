import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const InventoryFilters = ({ onFiltersChange, activeFilters }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState({
    warehouse: activeFilters.warehouse || 'all',
    category: activeFilters.category || 'all',
    stockStatus: activeFilters.stockStatus || 'all',
    supplier: activeFilters.supplier || 'all',
    dateRange: activeFilters.dateRange || '7d'
  });

  const warehouseOptions = [
    { value: 'all', label: 'All Warehouses' },
    { value: 'warehouse-a', label: 'Warehouse A' },
    { value: 'warehouse-b', label: 'Warehouse B' },
    { value: 'warehouse-c', label: 'Warehouse C' },
    { value: 'store-front', label: 'Store Front' }
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'mobile-cases', label: 'Mobile Cases' },
    { value: 'screen-protectors', label: 'Screen Protectors' },
    { value: 'chargers', label: 'Chargers' },
    { value: 'cables', label: 'Cables' },
    { value: 'power-banks', label: 'Power Banks' },
    { value: 'earphones', label: 'Earphones' },
    { value: 'speakers', label: 'Speakers' },
    { value: 'car-accessories', label: 'Car Accessories' }
  ];

  const stockStatusOptions = [
    { value: 'all', label: 'All Stock Levels' },
    { value: 'in-stock', label: 'In Stock' },
    { value: 'low-stock', label: 'Low Stock' },
    { value: 'out-of-stock', label: 'Out of Stock' },
    { value: 'overstock', label: 'Overstock' }
  ];

  const supplierOptions = [
    { value: 'all', label: 'All Suppliers' },
    { value: 'tech-solutions', label: 'Tech Solutions Ltd.' },
    { value: 'mobile-world', label: 'Mobile World Inc.' },
    { value: 'accessory-hub', label: 'Accessory Hub' },
    { value: 'digital-depot', label: 'Digital Depot' }
  ];

  const dateRangeOptions = [
    { value: '1d', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    const clearedFilters = {
      warehouse: 'all',
      category: 'all',
      stockStatus: 'all',
      supplier: 'all',
      dateRange: '7d'
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => value !== 'all' && value !== '7d').length;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="bg-card rounded-lg border border-border p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Icon name="Filter" size={20} className="text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Filters</h3>
            {activeFilterCount > 0 && (
              <span className="px-2 py-1 bg-primary text-primary-foreground rounded-full text-xs font-medium">
                {activeFilterCount}
              </span>
            )}
          </div>

          {/* Quick Filters */}
          <div className="hidden lg:flex items-center space-x-2">
            <select
              value={filters.warehouse}
              onChange={(e) => handleFilterChange('warehouse', e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-1 bg-background text-foreground"
            >
              {warehouseOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-1 bg-background text-foreground"
            >
              {categoryOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filters.stockStatus}
              onChange={(e) => handleFilterChange('stockStatus', e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-1 bg-background text-foreground"
            >
              {stockStatusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              iconName="X"
            >
              Clear All
            </Button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="lg:hidden p-2 hover:bg-muted rounded transition-smooth"
          >
            <Icon 
              name={isExpanded ? "ChevronUp" : "ChevronDown"} 
              size={16} 
              className="text-muted-foreground" 
            />
          </button>
          <Button
            variant="outline"
            size="sm"
            iconName="Download"
          >
            Export
          </Button>
        </div>
      </div>

      {/* Expanded Filters (Mobile) */}
      {(isExpanded || window.innerWidth >= 1024) && (
        <div className="lg:hidden mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Warehouse Location
            </label>
            <select
              value={filters.warehouse}
              onChange={(e) => handleFilterChange('warehouse', e.target.value)}
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background text-foreground"
            >
              {warehouseOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Product Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background text-foreground"
            >
              {categoryOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Stock Status
            </label>
            <select
              value={filters.stockStatus}
              onChange={(e) => handleFilterChange('stockStatus', e.target.value)}
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background text-foreground"
            >
              {stockStatusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Supplier
            </label>
            <select
              value={filters.supplier}
              onChange={(e) => handleFilterChange('supplier', e.target.value)}
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background text-foreground"
            >
              {supplierOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Date Range
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background text-foreground"
            >
              {dateRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, value]) => {
              if (value === 'all' || value === '7d') return null;
              
              const getFilterLabel = (key, value) => {
                const optionsMap = {
                  warehouse: warehouseOptions,
                  category: categoryOptions,
                  stockStatus: stockStatusOptions,
                  supplier: supplierOptions,
                  dateRange: dateRangeOptions
                };
                const option = optionsMap[key]?.find(opt => opt.value === value);
                return option ? option.label : value;
              };

              return (
                <div
                  key={key}
                  className="flex items-center space-x-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs"
                >
                  <span>{getFilterLabel(key, value)}</span>
                  <button
                    onClick={() => handleFilterChange(key, key === 'dateRange' ? '7d' : 'all')}
                    className="hover:bg-primary/20 rounded-full p-0.5 transition-smooth"
                  >
                    <Icon name="X" size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryFilters;