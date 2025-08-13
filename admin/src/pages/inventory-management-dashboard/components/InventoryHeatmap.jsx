import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const InventoryHeatmap = ({ inventoryData, onCategoryFilter }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);

  const categories = [
    'Mobile Cases', 'Screen Protectors', 'Chargers', 'Cables', 
    'Power Banks', 'Earphones', 'Speakers', 'Car Accessories'
  ];

  const locations = ['Warehouse A', 'Warehouse B', 'Warehouse C', 'Store Front'];

  const getStockLevel = (category, location) => {
    const item = inventoryData.find(item => 
      item.category === category && item.location === location
    );
    return item ? item.stockLevel : 0;
  };

  const getStockStatus = (stockLevel) => {
    if (stockLevel === 0) return 'out-of-stock';
    if (stockLevel < 20) return 'critical';
    if (stockLevel < 50) return 'low';
    if (stockLevel < 100) return 'medium';
    return 'high';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'out-of-stock': return 'bg-error';
      case 'critical': return 'bg-error/70';
      case 'low': return 'bg-warning';
      case 'medium': return 'bg-primary/60';
      case 'high': return 'bg-success';
      default: return 'bg-muted';
    }
  };

  const handleCellClick = (category) => {
    setSelectedCategory(category);
    onCategoryFilter(category);
  };

  const handleCellHover = (category, location, stockLevel) => {
    setHoveredCell({ category, location, stockLevel });
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Inventory Heatmap</h3>
          <p className="text-sm text-muted-foreground">Stock levels across categories and locations</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-success rounded"></div>
              <span className="text-muted-foreground">High</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-primary/60 rounded"></div>
              <span className="text-muted-foreground">Medium</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-warning rounded"></div>
              <span className="text-muted-foreground">Low</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-error rounded"></div>
              <span className="text-muted-foreground">Critical</span>
            </div>
          </div>
          <button className="flex items-center space-x-1 text-sm text-primary hover:text-primary/80 transition-smooth">
            <Icon name="Download" size={16} />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-5 gap-2 mb-2">
            <div className="text-sm font-medium text-muted-foreground p-2">Category</div>
            {locations.map((location) => (
              <div key={location} className="text-sm font-medium text-muted-foreground p-2 text-center">
                {location}
              </div>
            ))}
          </div>

          {/* Heatmap Grid */}
          <div className="space-y-1">
            {categories.map((category) => (
              <div key={category} className="grid grid-cols-5 gap-2">
                <div className="text-sm font-medium text-foreground p-3 bg-muted/30 rounded flex items-center">
                  {category}
                </div>
                {locations.map((location) => {
                  const stockLevel = getStockLevel(category, location);
                  const status = getStockStatus(stockLevel);
                  const colorClass = getStatusColor(status);
                  
                  return (
                    <div
                      key={`${category}-${location}`}
                      className={`relative h-12 rounded cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-md ${colorClass} ${
                        selectedCategory === category ? 'ring-2 ring-primary ring-offset-2' : ''
                      }`}
                      onClick={() => handleCellClick(category)}
                      onMouseEnter={() => handleCellHover(category, location, stockLevel)}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-white">
                          {stockLevel}
                        </span>
                      </div>
                      
                      {/* Hover Tooltip */}
                      {hoveredCell && 
                       hoveredCell.category === category && 
                       hoveredCell.location === location && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-md modal-shadow z-10 whitespace-nowrap">
                          <div className="font-medium">{category}</div>
                          <div className="text-muted-foreground">{location}</div>
                          <div className="text-primary">Stock: {stockLevel} units</div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedCategory && (
        <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Icon name="Filter" size={16} className="text-primary" />
              <span className="text-sm font-medium text-primary">
                Filtered by: {selectedCategory}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedCategory(null);
                onCategoryFilter(null);
              }}
              className="text-primary hover:text-primary/80 transition-smooth"
            >
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryHeatmap;