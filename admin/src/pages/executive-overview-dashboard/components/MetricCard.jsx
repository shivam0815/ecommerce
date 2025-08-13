import React from 'react';
import Icon from '../../../components/AppIcon';

const MetricCard = ({ 
  title, 
  value, 
  change, 
  changeType, 
  icon, 
  description,
  status = 'normal',
  className = "" 
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'border-success/20 bg-success/5';
      case 'warning': return 'border-warning/20 bg-warning/5';
      case 'critical': return 'border-error/20 bg-error/5';
      default: return 'border-border bg-card';
    }
  };

  const getChangeColor = () => {
    if (changeType === 'positive') return 'text-success';
    if (changeType === 'negative') return 'text-error';
    return 'text-muted-foreground';
  };

  const getChangeIcon = () => {
    if (changeType === 'positive') return 'ArrowUp';
    if (changeType === 'negative') return 'ArrowDown';
    return 'Minus';
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'good': return 'CheckCircle';
      case 'warning': return 'AlertTriangle';
      case 'critical': return 'XCircle';
      default: return 'Info';
    }
  };

  const getStatusIconColor = () => {
    switch (status) {
      case 'good': return 'text-success';
      case 'warning': return 'text-warning';
      case 'critical': return 'text-error';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className={`border rounded-lg p-6 dashboard-shadow transition-smooth hover:shadow-lg ${getStatusColor()} ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon name={icon} size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          </div>
        </div>
        
        {status !== 'normal' && (
          <div className="flex items-center space-x-1">
            <Icon 
              name={getStatusIcon()} 
              size={16} 
              className={getStatusIconColor()} 
            />
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        <div className="text-2xl font-semibold text-foreground">
          {value}
        </div>
        
        <div className="flex items-center justify-between">
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
        
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default MetricCard;