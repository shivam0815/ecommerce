import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const GeographicSalesMap = () => {
  const [viewMode, setViewMode] = useState('revenue');
  const [selectedState, setSelectedState] = useState(null);

  const stateData = [
    { 
      name: 'Maharashtra', 
      revenue: 12500000, 
      orders: 8500, 
      growth: 15.2, 
      avgDelivery: 2.3,
      topCities: ['Mumbai', 'Pune', 'Nagpur'],
      coordinates: { lat: 19.7515, lng: 75.7139 }
    },
    { 
      name: 'Karnataka', 
      revenue: 9800000, 
      orders: 6200, 
      growth: 22.1, 
      avgDelivery: 2.1,
      topCities: ['Bangalore', 'Mysore', 'Hubli'],
      coordinates: { lat: 15.3173, lng: 75.7139 }
    },
    { 
      name: 'Tamil Nadu', 
      revenue: 8900000, 
      orders: 5800, 
      growth: 18.7, 
      avgDelivery: 2.5,
      topCities: ['Chennai', 'Coimbatore', 'Madurai'],
      coordinates: { lat: 11.1271, lng: 78.6569 }
    },
    { 
      name: 'Delhi', 
      revenue: 7600000, 
      orders: 4900, 
      growth: 12.3, 
      avgDelivery: 1.8,
      topCities: ['New Delhi', 'Gurgaon', 'Noida'],
      coordinates: { lat: 28.7041, lng: 77.1025 }
    },
    { 
      name: 'Gujarat', 
      revenue: 6800000, 
      orders: 4200, 
      growth: 25.4, 
      avgDelivery: 2.2,
      topCities: ['Ahmedabad', 'Surat', 'Vadodara'],
      coordinates: { lat: 23.0225, lng: 72.5714 }
    },
    { 
      name: 'West Bengal', 
      revenue: 5900000, 
      orders: 3800, 
      growth: 8.9, 
      avgDelivery: 3.1,
      topCities: ['Kolkata', 'Howrah', 'Durgapur'],
      coordinates: { lat: 22.9868, lng: 87.8550 }
    }
  ];

  const formatRevenue = (revenue) => {
    if (revenue >= 10000000) return `₹${(revenue / 10000000).toFixed(1)}Cr`;
    if (revenue >= 100000) return `₹${(revenue / 100000).toFixed(1)}L`;
    return `₹${(revenue / 1000).toFixed(0)}K`;
  };

  const getIntensityColor = (value, max, type) => {
    const intensity = value / max;
    if (type === 'revenue') {
      if (intensity > 0.8) return 'bg-blue-600';
      if (intensity > 0.6) return 'bg-blue-500';
      if (intensity > 0.4) return 'bg-blue-400';
      if (intensity > 0.2) return 'bg-blue-300';
      return 'bg-blue-200';
    } else {
      if (intensity > 0.8) return 'bg-green-600';
      if (intensity > 0.6) return 'bg-green-500';
      if (intensity > 0.4) return 'bg-green-400';
      if (intensity > 0.2) return 'bg-green-300';
      return 'bg-green-200';
    }
  };

  const maxRevenue = Math.max(...stateData.map(s => s.revenue));
  const maxGrowth = Math.max(...stateData.map(s => s.growth));

  return (
    <div className="bg-card border border-border rounded-lg p-6 dashboard-shadow">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Geographic Sales Distribution</h3>
          <p className="text-sm text-muted-foreground">Revenue and performance by Indian states</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'revenue' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('revenue')}
          >
            Revenue
          </Button>
          <Button
            variant={viewMode === 'growth' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('growth')}
          >
            Growth
          </Button>
          <Button variant="ghost" size="sm" iconName="Maximize2">
            Fullscreen
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Visualization */}
        <div className="lg:col-span-2">
          <div className="relative bg-muted/30 rounded-lg p-4 h-96 overflow-hidden">
            {/* Google Maps Iframe */}
            <iframe
              width="100%"
              height="100%"
              loading="lazy"
              title="India Sales Map"
              referrerPolicy="no-referrer-when-downgrade"
              src="https://www.google.com/maps?q=20.5937,78.9629&z=5&output=embed"
              className="rounded-lg"
            />
            
            {/* Overlay with state markers */}
            <div className="absolute inset-0 pointer-events-none">
              {stateData.map((state, index) => (
                <div
                  key={state.name}
                  className="absolute pointer-events-auto cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${20 + (index % 3) * 25}%`,
                    top: `${20 + Math.floor(index / 3) * 30}%`
                  }}
                  onClick={() => setSelectedState(selectedState === state.name ? null : state.name)}
                >
                  <div className={`w-6 h-6 rounded-full border-2 border-white shadow-lg transition-transform hover:scale-110 ${
                    getIntensityColor(
                      viewMode === 'revenue' ? state.revenue : state.growth,
                      viewMode === 'revenue' ? maxRevenue : maxGrowth,
                      viewMode
                    )
                  }`}>
                    <div className="w-full h-full rounded-full animate-ping opacity-20 bg-current" />
                  </div>
                  
                  {/* State tooltip */}
                  {selectedState === state.name && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-popover border border-border rounded-lg p-3 shadow-lg min-w-48 z-10">
                      <h4 className="font-semibold text-foreground mb-2">{state.name}</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Revenue:</span>
                          <span className="font-medium">{formatRevenue(state.revenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Orders:</span>
                          <span className="font-medium">{state.orders.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Growth:</span>
                          <span className="font-medium text-success">+{state.growth}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg Delivery:</span>
                          <span className="font-medium">{state.avgDelivery} days</span>
                        </div>
                      </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between mt-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-foreground">
                {viewMode === 'revenue' ? 'Revenue Intensity' : 'Growth Rate'}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">Low</span>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`w-4 h-4 rounded ${
                        viewMode === 'revenue' 
                          ? `bg-blue-${level * 100 + 100}` 
                          : `bg-green-${level * 100 + 100}`
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">High</span>
              </div>
            </div>
            <Button variant="outline" size="sm" iconName="Download">
              Export Map
            </Button>
          </div>
        </div>

        {/* State Rankings */}
        <div className="space-y-4">
          <h4 className="font-semibold text-foreground">Top Performing States</h4>
          <div className="space-y-3">
            {stateData
              .sort((a, b) => viewMode === 'revenue' ? b.revenue - a.revenue : b.growth - a.growth)
              .map((state, index) => (
                <div
                  key={state.name}
                  className={`p-3 rounded-lg border transition-smooth cursor-pointer ${
                    selectedState === state.name
                      ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedState(selectedState === state.name ? null : state.name)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <span className="font-medium text-foreground">{state.name}</span>
                    </div>
                    <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="font-medium">{formatRevenue(state.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Growth:</span>
                      <span className="font-medium text-success">+{state.growth}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Orders:</span>
                      <span className="font-medium">{state.orders.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Top cities */}
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="flex flex-wrap gap-1">
                      {state.topCities.map((city) => (
                        <span
                          key={city}
                          className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded"
                        >
                          {city}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeographicSalesMap;