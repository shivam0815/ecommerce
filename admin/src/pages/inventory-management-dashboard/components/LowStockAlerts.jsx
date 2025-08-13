import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';

const LowStockAlerts = ({ lowStockItems, onReorder }) => {
  const [sortBy, setSortBy] = useState('urgency');
  const [expandedItem, setExpandedItem] = useState(null);

  const sortedItems = [...lowStockItems].sort((a, b) => {
    switch (sortBy) {
      case 'urgency':
        return a.currentStock - b.currentStock;
      case 'name':
        return a.productName.localeCompare(b.productName);
      case 'category':
        return a.category.localeCompare(b.category);
      case 'leadTime':
        return a.supplierLeadTime - b.supplierLeadTime;
      default:
        return 0;
    }
  });

  const getUrgencyLevel = (currentStock, reorderPoint) => {
    const ratio = currentStock / reorderPoint;
    if (ratio <= 0.2) return 'critical';
    if (ratio <= 0.5) return 'high';
    return 'medium';
  };

  const getUrgencyColor = (level) => {
    switch (level) {
      case 'critical': return 'text-error bg-error/10';
      case 'high': return 'text-warning bg-warning/10';
      case 'medium': return 'text-primary bg-primary/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const handleReorder = (item) => {
    onReorder(item);
  };

  const toggleExpanded = (itemId) => {
    setExpandedItem(expandedItem === itemId ? null : itemId);
  };

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Low Stock Alerts</h3>
            <p className="text-sm text-muted-foreground">
              {lowStockItems.length} items require attention
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-1 bg-background text-foreground"
            >
              <option value="urgency">Sort by Urgency</option>
              <option value="name">Sort by Name</option>
              <option value="category">Sort by Category</option>
              <option value="leadTime">Sort by Lead Time</option>
            </select>
            <Button variant="outline" size="sm" iconName="Download">
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {sortedItems.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="Package" size={48} className="text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">No Low Stock Items</h4>
            <p className="text-muted-foreground">All inventory levels are healthy</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sortedItems.map((item) => {
              const urgencyLevel = getUrgencyLevel(item.currentStock, item.reorderPoint);
              const urgencyColor = getUrgencyColor(urgencyLevel);
              const isExpanded = expandedItem === item.id;

              return (
                <div key={item.id} className="p-4 hover:bg-muted/30 transition-smooth">
                  <div className="flex items-center space-x-4">
                    {/* Product Image */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <Image
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-sm font-medium text-foreground truncate">
                          {item.productName}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${urgencyColor}`}>
                          {urgencyLevel}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>SKU: {item.sku}</span>
                        <span>Category: {item.category}</span>
                        <span>Location: {item.location}</span>
                      </div>
                    </div>

                    {/* Stock Info */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-medium text-foreground">
                        {item.currentStock} / {item.reorderPoint}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Current / Reorder Point
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReorder(item)}
                        iconName="ShoppingCart"
                      >
                        Reorder
                      </Button>
                      <button
                        onClick={() => toggleExpanded(item.id)}
                        className="p-1 hover:bg-muted rounded transition-smooth"
                      >
                        <Icon 
                          name={isExpanded ? "ChevronUp" : "ChevronDown"} 
                          size={16} 
                          className="text-muted-foreground" 
                        />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Supplier:</span>
                          <div className="font-medium text-foreground">{item.supplier}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Lead Time:</span>
                          <div className="font-medium text-foreground">{item.supplierLeadTime} days</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Ordered:</span>
                          <div className="font-medium text-foreground">{item.lastOrderDate}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg. Daily Sales:</span>
                          <div className="font-medium text-foreground">{item.avgDailySales} units</div>
                        </div>
                      </div>
                      
                      <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center space-x-2 text-sm">
                          <Icon name="AlertTriangle" size={16} className="text-warning" />
                          <span className="text-foreground">
                            Estimated stockout in {Math.ceil(item.currentStock / item.avgDailySales)} days
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LowStockAlerts;