import React from 'react';
import Icon from '../../../components/AppIcon';

const RevenueKPICard = ({ 
  title, 
  value, 
  currency = '₹', 
  trend, 
  trendDirection, 
  comparison, 
  icon, 
  className = '' 
}) => {
  const formatValue = (val) => {
    if (val >= 10000000) {
      return `${(val / 10000000).toFixed(1)}Cr`;
    } else if (val >= 100000) {
      return `${(val / 100000).toFixed(1)}L`;
    } else if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}K`;
    }
    return val.toLocaleString('en-IN');
  };

  const getTrendColor = () => {
    if (trendDirection === 'up') return 'text-success';
    if (trendDirection === 'down') return 'text-error';
    return 'text-muted-foreground';
  };

  const getTrendIcon = () => {
    if (trendDirection === 'up') return 'TrendingUp';
    if (trendDirection === 'down') return 'TrendingDown';
    return 'Minus';
  };

  return (
    <div className={`bg-card border border-border rounded-lg p-6 dashboard-shadow transition-smooth hover:shadow-lg ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon name={icon} size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          </div>
        </div>
        <div className={`flex items-center space-x-1 ${getTrendColor()}`}>
          <Icon name={getTrendIcon()} size={16} />
          <span className="text-sm font-medium">{trend}%</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-foreground">
            {currency}{formatValue(value)}
          </span>
        </div>
        
        {comparison && (
          <div className="text-xs text-muted-foreground">
            vs {comparison.period}: {currency}{formatValue(comparison.value)}
          </div>
        )}
      </div>

      {/* Mini trend chart placeholder */}
      <div className="mt-4 h-8 bg-muted/30 rounded flex items-end space-x-1 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t ${
              trendDirection === 'up' ? 'bg-success/60' : 
              trendDirection === 'down' ? 'bg-error/60' : 'bg-muted-foreground/60'
            }`}
            style={{ height: `${Math.random() * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
};

export default RevenueKPICard;