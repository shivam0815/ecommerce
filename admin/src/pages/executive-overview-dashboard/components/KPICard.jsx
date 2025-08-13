import React from 'react';
import Icon from '../../../components/AppIcon';

const KPICard = ({ 
  title, 
  value, 
  change, 
  changeType, 
  icon, 
  sparklineData = [], 
  currency = false,
  className = "" 
}) => {
  const getChangeColor = () => {
    if (changeType === 'positive') return 'text-success';
    if (changeType === 'negative') return 'text-error';
    return 'text-muted-foreground';
  };

  const getChangeIcon = () => {
    if (changeType === 'positive') return 'TrendingUp';
    if (changeType === 'negative') return 'TrendingDown';
    return 'Minus';
  };

  const formatValue = (val) => {
    if (currency) {
      return `₹${val.toLocaleString('en-IN')}`;
    }
    return val.toLocaleString('en-IN');
  };

  // Simple sparkline SVG generation
  const generateSparkline = () => {
    if (!sparklineData.length) return null;
    
    const width = 60;
    const height = 20;
    const max = Math.max(...sparklineData);
    const min = Math.min(...sparklineData);
    const range = max - min || 1;
    
    const points = sparklineData.map((value, index) => {
      const x = (index / (sparklineData.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="opacity-60">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={changeType === 'positive' ? 'text-success' : changeType === 'negative' ? 'text-error' : 'text-primary'}
        />
      </svg>
    );
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
        <div className="flex flex-col items-end">
          {generateSparkline()}
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="text-2xl font-semibold text-foreground">
          {formatValue(value)}
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-1 ${getChangeColor()}`}>
            <Icon name={getChangeIcon()} size={14} />
            <span className="text-sm font-medium">
              {Math.abs(change)}%
            </span>
          </div>
          <span className="text-xs text-muted-foreground">vs last period</span>
        </div>
      </div>
    </div>
  );
};

export default KPICard;