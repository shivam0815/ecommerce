import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RevenueChart = () => {
  const [activeLines, setActiveLines] = useState({
    total: true,
    mobile: true,
    accessories: true,
    online: true,
    offline: false
  });

  const [timeRange, setTimeRange] = useState('7d');

  const chartData = [
    { date: '01 Jul', total: 2400000, mobile: 1400000, accessories: 1000000, online: 1800000, offline: 600000 },
    { date: '02 Jul', total: 2100000, mobile: 1200000, accessories: 900000, online: 1600000, offline: 500000 },
    { date: '03 Jul', total: 2800000, mobile: 1600000, accessories: 1200000, online: 2100000, offline: 700000 },
    { date: '04 Jul', total: 3200000, mobile: 1900000, accessories: 1300000, online: 2400000, offline: 800000 },
    { date: '05 Jul', total: 2900000, mobile: 1700000, accessories: 1200000, online: 2200000, offline: 700000 },
    { date: '06 Jul', total: 3500000, mobile: 2100000, accessories: 1400000, online: 2600000, offline: 900000 },
    { date: '07 Jul', total: 3800000, mobile: 2300000, accessories: 1500000, online: 2900000, offline: 900000 }
  ];

  const lineConfig = {
    total: { color: '#2962FF', name: 'Total Revenue' },
    mobile: { color: '#4CAF50', name: 'Mobile Phones' },
    accessories: { color: '#FF9800', name: 'Accessories' },
    online: { color: '#9C27B0', name: 'Online Sales' },
    offline: { color: '#607D8B', name: 'Offline Sales' }
  };

  const toggleLine = (lineKey) => {
    setActiveLines(prev => ({
      ...prev,
      [lineKey]: !prev[lineKey]
    }));
  };

  const formatTooltipValue = (value) => {
    return `₹${(value / 100000).toFixed(1)}L`;
  };

  const timeRangeOptions = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '1y', label: '1 Year' }
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-6 dashboard-shadow">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Revenue Trends</h3>
          <p className="text-sm text-muted-foreground">Multi-channel revenue performance analysis</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Time Range Selector */}
          <div className="flex items-center space-x-2">
            {timeRangeOptions.map((option) => (
              <Button
                key={option.value}
                variant={timeRange === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {/* Chart Controls */}
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" iconName="Download">
              Export
            </Button>
            <Button variant="ghost" size="sm" iconName="Maximize2">
              Fullscreen
            </Button>
          </div>
        </div>
      </div>

      {/* Interactive Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
        {Object.entries(lineConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => toggleLine(key)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-smooth ${
              activeLines[key] 
                ? 'bg-background shadow-sm' 
                : 'opacity-50 hover:opacity-75'
            }`}
          >
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: activeLines[key] ? config.color : '#ccc' }}
            />
            <span className="text-sm font-medium text-foreground">{config.name}</span>
            <Icon 
              name={activeLines[key] ? 'Eye' : 'EyeOff'} 
              size={14} 
              className="text-muted-foreground" 
            />
          </button>
        ))}
      </div>

      {/* Chart Container */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis 
              dataKey="date" 
              stroke="var(--color-muted-foreground)"
              fontSize={12}
            />
            <YAxis 
              stroke="var(--color-muted-foreground)"
              fontSize={12}
              tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'var(--color-popover)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
              }}
              formatter={(value, name) => [formatTooltipValue(value), lineConfig[name]?.name || name]}
              labelStyle={{ color: 'var(--color-foreground)' }}
            />
            
            {Object.entries(lineConfig).map(([key, config]) => (
              activeLines[key] && (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={config.color}
                  strokeWidth={2}
                  dot={{ fill: config.color, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: config.color, strokeWidth: 2 }}
                />
              )
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Summary */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(lineConfig).map(([key, config]) => {
          const latestValue = chartData[chartData.length - 1][key];
          const previousValue = chartData[chartData.length - 2][key];
          const change = ((latestValue - previousValue) / previousValue * 100).toFixed(1);
          
          return (
            <div key={key} className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-center space-x-2 mb-1">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-xs font-medium text-muted-foreground">{config.name}</span>
              </div>
              <div className="text-sm font-semibold text-foreground">
                ₹{(latestValue / 100000).toFixed(1)}L
              </div>
              <div className={`text-xs flex items-center justify-center space-x-1 ${
                change >= 0 ? 'text-success' : 'text-error'
              }`}>
                <Icon name={change >= 0 ? 'TrendingUp' : 'TrendingDown'} size={12} />
                <span>{Math.abs(change)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RevenueChart;