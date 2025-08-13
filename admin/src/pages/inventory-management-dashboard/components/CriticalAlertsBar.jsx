import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const CriticalAlertsBar = ({ criticalAlerts, onReorderAll, onDismissAlert }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);

  const visibleAlerts = criticalAlerts.filter(alert => !dismissedAlerts.includes(alert.id));
  const criticalCount = visibleAlerts.filter(alert => alert.severity === 'critical').length;
  const highCount = visibleAlerts.filter(alert => alert.severity === 'high').length;

  const handleDismiss = (alertId) => {
    setDismissedAlerts([...dismissedAlerts, alertId]);
    onDismissAlert(alertId);
  };

  const handleReorderAll = () => {
    const criticalItems = visibleAlerts.filter(alert => alert.severity === 'critical');
    onReorderAll(criticalItems);
  };

  const getSeverityConfig = (severity) => {
    switch (severity) {
      case 'critical':
        return {
          color: 'text-error',
          bgColor: 'bg-error/10',
          borderColor: 'border-error/20',
          icon: 'AlertTriangle'
        };
      case 'high':
        return {
          color: 'text-warning',
          bgColor: 'bg-warning/10',
          borderColor: 'border-warning/20',
          icon: 'AlertCircle'
        };
      default:
        return {
          color: 'text-primary',
          bgColor: 'bg-primary/10',
          borderColor: 'border-primary/20',
          icon: 'Info'
        };
    }
  };

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className="bg-error/5 border border-error/20 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Icon name="AlertTriangle" size={20} className="text-error" />
            <div>
              <h3 className="text-sm font-semibold text-error">Critical Inventory Alerts</h3>
              <p className="text-xs text-muted-foreground">
                {criticalCount} critical, {highCount} high priority items need attention
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {criticalCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReorderAll}
              iconName="ShoppingCart"
            >
              Reorder All Critical ({criticalCount})
            </Button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-error/10 rounded transition-smooth"
          >
            <Icon 
              name={isExpanded ? "ChevronUp" : "ChevronDown"} 
              size={16} 
              className="text-error" 
            />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-2">
          {visibleAlerts.slice(0, 5).map((alert) => {
            const severityConfig = getSeverityConfig(alert.severity);
            
            return (
              <div
                key={alert.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${severityConfig.bgColor} ${severityConfig.borderColor}`}
              >
                <div className="flex items-center space-x-3">
                  <Icon name={severityConfig.icon} size={16} className={severityConfig.color} />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-foreground">
                        {alert.productName}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityConfig.color} ${severityConfig.bgColor}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {alert.message} • SKU: {alert.sku} • Location: {alert.location}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="text-right text-xs">
                    <div className="font-medium text-foreground">
                      {alert.currentStock} units left
                    </div>
                    <div className="text-muted-foreground">
                      Est. stockout: {alert.estimatedStockoutDays} days
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => alert.onReorder(alert)}
                    iconName="ShoppingCart"
                  >
                    Reorder
                  </Button>
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="p-1 hover:bg-muted rounded transition-smooth"
                    title="Dismiss alert"
                  >
                    <Icon name="X" size={14} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}

          {visibleAlerts.length > 5 && (
            <div className="text-center pt-2">
              <button className="text-sm text-primary hover:text-primary/80 transition-smooth">
                View {visibleAlerts.length - 5} more alerts
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CriticalAlertsBar;