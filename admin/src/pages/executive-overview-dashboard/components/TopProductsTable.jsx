import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';

const TopProductsTable = ({ products = [] }) => {
  const [sortBy, setSortBy] = useState('revenue');
  const [sortOrder, setSortOrder] = useState('desc');

  const sortedProducts = [...products].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    }
    return aValue < bValue ? 1 : -1;
  });

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getPerformanceColor = (percentage) => {
    if (percentage >= 15) return 'text-success';
    if (percentage >= 5) return 'text-warning';
    return 'text-error';
  };

  const SortIcon = ({ field }) => {
    if (sortBy !== field) {
      return <Icon name="ArrowUpDown" size={12} className="text-muted-foreground" />;
    }
    return (
      <Icon 
        name={sortOrder === 'asc' ? 'ArrowUp' : 'ArrowDown'} 
        size={12} 
        className="text-primary" 
      />
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg dashboard-shadow">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Top Performing Products</h3>
            <p className="text-sm text-muted-foreground">Revenue contribution analysis</p>
          </div>
          <button className="p-2 hover:bg-muted rounded-lg transition-smooth">
            <Icon name="MoreVertical" size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Product
                </th>
                <th 
                  className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-smooth"
                  onClick={() => handleSort('revenue')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Revenue</span>
                    <SortIcon field="revenue" />
                  </div>
                </th>
                <th 
                  className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-smooth"
                  onClick={() => handleSort('units')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Units</span>
                    <SortIcon field="units" />
                  </div>
                </th>
                <th 
                  className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-smooth"
                  onClick={() => handleSort('contribution')}
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Share</span>
                    <SortIcon field="contribution" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedProducts.map((product, index) => (
                <tr 
                  key={product.id} 
                  className="hover:bg-muted/20 transition-smooth cursor-pointer"
                >
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-muted rounded-lg overflow-hidden">
                          <Image
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {product.category}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="text-sm font-medium text-foreground">
                      {formatCurrency(product.revenue)}
                    </div>
                    <div className={`text-xs ${getPerformanceColor(product.growth)}`}>
                      {product.growth > 0 ? '+' : ''}{product.growth}%
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="text-sm font-medium text-foreground">
                      {product.units.toLocaleString('en-IN')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      sold
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <div className="text-sm font-medium text-foreground">
                        {product.contribution}%
                      </div>
                      <div className="w-12 bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(product.contribution * 2, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-4 border-t border-border bg-muted/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing top {sortedProducts.length} products</span>
          <button className="text-primary hover:text-primary/80 font-medium transition-smooth">
            View all products →
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopProductsTable;