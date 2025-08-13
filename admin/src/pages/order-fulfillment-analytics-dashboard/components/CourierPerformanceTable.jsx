import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const CourierPerformanceTable = () => {
  const [sortConfig, setSortConfig] = useState({ key: 'deliveryTime', direction: 'asc' });

  const courierData = [
    {
      id: 'delhivery',
      name: 'Delhivery',
      logo: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=40&h=40&fit=crop&crop=center',
      totalOrders: 2156,
      deliveryTime: '24.2 hrs',
      deliveryTimeValue: 24.2,
      successRate: 96.8,
      costPerShipment: 45.50,
      rating: 4.6,
      onTimeDelivery: 94.2,
      returnRate: 2.1,
      coverage: 'Pan India',
      trend: 'up'
    },
    {
      id: 'dtdc',
      name: 'DTDC',
      logo: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=40&h=40&fit=crop&crop=center',
      totalOrders: 1847,
      deliveryTime: '26.8 hrs',
      deliveryTimeValue: 26.8,
      successRate: 95.4,
      costPerShipment: 42.75,
      rating: 4.4,
      onTimeDelivery: 91.8,
      returnRate: 2.8,
      coverage: 'Pan India',
      trend: 'down'
    },
    {
      id: 'bluedart',
      name: 'Blue Dart',
      logo: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=40&h=40&fit=crop&crop=center',
      totalOrders: 1234,
      deliveryTime: '18.5 hrs',
      deliveryTimeValue: 18.5,
      successRate: 98.2,
      costPerShipment: 52.30,
      rating: 4.8,
      onTimeDelivery: 97.1,
      returnRate: 1.4,
      coverage: 'Metro Cities',
      trend: 'up'
    },
    {
      id: 'fedex',
      name: 'FedEx',
      logo: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=40&h=40&fit=crop&crop=center',
      totalOrders: 892,
      deliveryTime: '16.2 hrs',
      deliveryTimeValue: 16.2,
      successRate: 97.9,
      costPerShipment: 58.90,
      rating: 4.7,
      onTimeDelivery: 96.8,
      returnRate: 1.6,
      coverage: 'Premium',
      trend: 'up'
    },
    {
      id: 'aramex',
      name: 'Aramex',
      logo: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=40&h=40&fit=crop&crop=center',
      totalOrders: 567,
      deliveryTime: '28.4 hrs',
      deliveryTimeValue: 28.4,
      successRate: 93.6,
      costPerShipment: 48.20,
      rating: 4.2,
      onTimeDelivery: 89.4,
      returnRate: 3.2,
      coverage: 'Regional',
      trend: 'stable'
    },
    {
      id: 'ecom',
      name: 'Ecom Express',
      logo: 'https://images.unsplash.com/photo-1494412651409-8963ce7935a7?w=40&h=40&fit=crop&crop=center',
      totalOrders: 445,
      deliveryTime: '32.1 hrs',
      deliveryTimeValue: 32.1,
      successRate: 92.8,
      costPerShipment: 38.75,
      rating: 4.1,
      onTimeDelivery: 87.2,
      returnRate: 3.8,
      coverage: 'Tier 2/3 Cities',
      trend: 'down'
    }
  ];

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...courierData].sort((a, b) => {
    if (sortConfig.key) {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    }
    return 0;
  });

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up': return { icon: 'TrendingUp', color: 'text-success' };
      case 'down': return { icon: 'TrendingDown', color: 'text-error' };
      default: return { icon: 'Minus', color: 'text-muted-foreground' };
    }
  };

  const getRatingStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    return (
      <div className="flex items-center space-x-1">
        {[...Array(5)].map((_, i) => (
          <Icon
            key={i}
            name={i < fullStars ? 'Star' : (i === fullStars && hasHalfStar ? 'StarHalf' : 'Star')}
            size={12}
            className={i < fullStars || (i === fullStars && hasHalfStar) ? 'text-warning fill-current' : 'text-muted-foreground'}
          />
        ))}
        <span className="text-xs text-muted-foreground ml-1">{rating}</span>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Courier Performance Comparison</h2>
        <div className="flex items-center space-x-2">
          <Icon name="Download" size={16} className="text-muted-foreground" />
          <button className="text-sm text-primary hover:text-primary/80 transition-smooth">
            Export Report
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                Courier Partner
              </th>
              <th 
                className="text-left py-3 px-2 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-smooth"
                onClick={() => handleSort('totalOrders')}
              >
                <div className="flex items-center space-x-1">
                  <span>Orders</span>
                  <Icon name="ArrowUpDown" size={12} />
                </div>
              </th>
              <th 
                className="text-left py-3 px-2 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-smooth"
                onClick={() => handleSort('deliveryTimeValue')}
              >
                <div className="flex items-center space-x-1">
                  <span>Avg Delivery</span>
                  <Icon name="ArrowUpDown" size={12} />
                </div>
              </th>
              <th 
                className="text-left py-3 px-2 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-smooth"
                onClick={() => handleSort('successRate')}
              >
                <div className="flex items-center space-x-1">
                  <span>Success Rate</span>
                  <Icon name="ArrowUpDown" size={12} />
                </div>
              </th>
              <th 
                className="text-left py-3 px-2 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-smooth"
                onClick={() => handleSort('costPerShipment')}
              >
                <div className="flex items-center space-x-1">
                  <span>Cost/Shipment</span>
                  <Icon name="ArrowUpDown" size={12} />
                </div>
              </th>
              <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                Rating
              </th>
              <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                Performance
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((courier) => {
              const trendConfig = getTrendIcon(courier.trend);
              
              return (
                <tr key={courier.id} className="border-b border-border hover:bg-muted/30 transition-smooth">
                  <td className="py-4 px-2">
                    <div className="flex items-center space-x-3">
                      <img
                        src={courier.logo}
                        alt={courier.name}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          e.target.src = '/assets/images/no_image.png';
                        }}
                      />
                      <div>
                        <div className="font-medium text-foreground">{courier.name}</div>
                        <div className="text-xs text-muted-foreground">{courier.coverage}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    <div className="font-medium text-foreground">
                      {courier.totalOrders.toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    <div className="font-medium text-foreground">{courier.deliveryTime}</div>
                  </td>
                  <td className="py-4 px-2">
                    <div className="flex items-center space-x-2">
                      <div className="font-medium text-foreground">{courier.successRate}%</div>
                      <div className={`w-16 h-2 bg-muted rounded-full overflow-hidden`}>
                        <div 
                          className="h-full bg-success rounded-full"
                          style={{ width: `${courier.successRate}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    <div className="font-medium text-foreground">
                      ₹{courier.costPerShipment.toFixed(2)}
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    {getRatingStars(courier.rating)}
                  </td>
                  <td className="py-4 px-2">
                    <div className="flex items-center space-x-2">
                      <Icon name={trendConfig.icon} size={16} className={trendConfig.color} />
                      <div className="text-sm">
                        <div className="text-foreground">{courier.onTimeDelivery}% On-time</div>
                        <div className="text-muted-foreground">{courier.returnRate}% Returns</div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-lg font-bold text-success">96.2%</div>
            <div className="text-muted-foreground">Overall Success Rate</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary">₹47.50</div>
            <div className="text-muted-foreground">Avg Cost per Shipment</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-secondary">24.8 hrs</div>
            <div className="text-muted-foreground">Avg Delivery Time</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourierPerformanceTable;