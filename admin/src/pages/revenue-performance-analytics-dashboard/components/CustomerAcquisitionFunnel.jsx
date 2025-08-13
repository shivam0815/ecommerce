import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const CustomerAcquisitionFunnel = () => {
  const [selectedSource, setSelectedSource] = useState('all');

  const funnelData = [
    {
      stage: 'Website Visitors',
      value: 125000,
      percentage: 100,
      color: 'bg-blue-500',
      icon: 'Users'
    },
    {
      stage: 'Product Views',
      value: 87500,
      percentage: 70,
      color: 'bg-indigo-500',
      icon: 'Eye'
    },
    {
      stage: 'Add to Cart',
      value: 31250,
      percentage: 25,
      color: 'bg-purple-500',
      icon: 'ShoppingCart'
    },
    {
      stage: 'Checkout Started',
      value: 18750,
      percentage: 15,
      color: 'bg-pink-500',
      icon: 'CreditCard'
    },
    {
      stage: 'Orders Completed',
      value: 12500,
      percentage: 10,
      color: 'bg-green-500',
      icon: 'CheckCircle'
    }
  ];

  const trafficSources = [
    { id: 'all', name: 'All Sources', visitors: 125000, conversion: 10.0, color: 'bg-gray-500' },
    { id: 'organic', name: 'Organic Search', visitors: 45000, conversion: 12.5, color: 'bg-green-500' },
    { id: 'paid', name: 'Paid Ads', visitors: 35000, conversion: 8.2, color: 'bg-blue-500' },
    { id: 'social', name: 'Social Media', visitors: 25000, conversion: 6.8, color: 'bg-purple-500' },
    { id: 'email', name: 'Email Marketing', visitors: 15000, conversion: 15.3, color: 'bg-orange-500' },
    { id: 'direct', name: 'Direct Traffic', visitors: 5000, conversion: 18.0, color: 'bg-gray-700' }
  ];

  const formatNumber = (num) => {
    if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString('en-IN');
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 dashboard-shadow">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Customer Acquisition Funnel</h3>
          <p className="text-sm text-muted-foreground">Conversion rates by traffic source</p>
        </div>
        <Button variant="ghost" size="sm" iconName="MoreHorizontal" />
      </div>

      {/* Traffic Source Selector */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {trafficSources.map((source) => (
            <button
              key={source.id}
              onClick={() => setSelectedSource(source.id)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-smooth ${
                selectedSource === source.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${source.color}`} />
              <span>{source.name}</span>
              <span className="text-xs opacity-75">({source.conversion}%)</span>
            </button>
          ))}
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className="space-y-4 mb-6">
        {funnelData.map((stage, index) => (
          <div key={stage.stage} className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 ${stage.color} rounded-lg flex items-center justify-center`}>
                  <Icon name={stage.icon} size={16} className="text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground">{stage.stage}</h4>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(stage.value)} users • {stage.percentage}% of total
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-foreground">
                  {formatNumber(stage.value)}
                </div>
                {index > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {((stage.value / funnelData[index - 1].value) * 100).toFixed(1)}% conversion
                  </div>
                )}
              </div>
            </div>
            
            {/* Funnel Bar */}
            <div className="relative h-12 bg-muted rounded-lg overflow-hidden">
              <div
                className={`h-full ${stage.color} transition-all duration-500 ease-out`}
                style={{ width: `${stage.percentage}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-medium text-white mix-blend-difference">
                  {stage.percentage}%
                </span>
              </div>
            </div>

            {/* Drop-off indicator */}
            {index < funnelData.length - 1 && (
              <div className="flex items-center justify-center mt-2">
                <div className="flex items-center space-x-2 px-3 py-1 bg-error/10 text-error rounded-full text-xs">
                  <Icon name="TrendingDown" size={12} />
                  <span>
                    {formatNumber(stage.value - funnelData[index + 1].value)} drop-off
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Conversion Metrics */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">10.0%</div>
          <div className="text-sm text-muted-foreground">Overall Conversion</div>
          <div className="flex items-center justify-center space-x-1 mt-1 text-success">
            <Icon name="TrendingUp" size={12} />
            <span className="text-xs">+2.3%</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">₹2,400</div>
          <div className="text-sm text-muted-foreground">Avg. Order Value</div>
          <div className="flex items-center justify-center space-x-1 mt-1 text-success">
            <Icon name="TrendingUp" size={12} />
            <span className="text-xs">+5.7%</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
        <Button variant="outline" size="sm" iconName="Filter">
          Filter Sources
        </Button>
        <Button variant="outline" size="sm" iconName="Download">
          Export Report
        </Button>
      </div>
    </div>
  );
};

export default CustomerAcquisitionFunnel;