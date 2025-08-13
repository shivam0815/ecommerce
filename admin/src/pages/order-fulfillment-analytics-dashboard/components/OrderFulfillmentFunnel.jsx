import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const OrderFulfillmentFunnel = ({ onStageClick }) => {
  const [hoveredStage, setHoveredStage] = useState(null);

  const funnelData = [
    {
      id: 'order-placed',
      label: 'Order Placed',
      count: 2847,
      percentage: 100,
      conversionRate: null,
      color: 'bg-primary',
      textColor: 'text-primary-foreground',
      icon: 'ShoppingCart',
      avgTime: '0 min',
      bottleneck: false
    },
    {
      id: 'payment-verified',
      label: 'Payment Verified',
      count: 2834,
      percentage: 99.5,
      conversionRate: 99.5,
      color: 'bg-secondary',
      textColor: 'text-secondary-foreground',
      icon: 'CreditCard',
      avgTime: '2 min',
      bottleneck: false
    },
    {
      id: 'inventory-allocated',
      label: 'Inventory Allocated',
      count: 2789,
      percentage: 98.0,
      conversionRate: 98.4,
      color: 'bg-accent',
      textColor: 'text-accent-foreground',
      icon: 'Package',
      avgTime: '15 min',
      bottleneck: true
    },
    {
      id: 'picked-packed',
      label: 'Picked & Packed',
      count: 2756,
      percentage: 96.8,
      conversionRate: 98.8,
      color: 'bg-success',
      textColor: 'text-success-foreground',
      icon: 'PackageCheck',
      avgTime: '45 min',
      bottleneck: false
    },
    {
      id: 'label-generated',
      label: 'Label Generated',
      count: 2745,
      percentage: 96.4,
      conversionRate: 99.6,
      color: 'bg-warning',
      textColor: 'text-warning-foreground',
      icon: 'FileText',
      avgTime: '5 min',
      bottleneck: false
    },
    {
      id: 'shipped',
      label: 'Shipped',
      count: 2723,
      percentage: 95.6,
      conversionRate: 99.2,
      color: 'bg-secondary',
      textColor: 'text-secondary-foreground',
      icon: 'Truck',
      avgTime: '2.1 hrs',
      bottleneck: false
    },
    {
      id: 'delivered',
      label: 'Delivered',
      count: 2621,
      percentage: 92.1,
      conversionRate: 96.3,
      color: 'bg-success',
      textColor: 'text-success-foreground',
      icon: 'CheckCircle',
      avgTime: '24.5 hrs',
      bottleneck: false
    }
  ];

  const handleStageClick = (stage) => {
    onStageClick && onStageClick(stage);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Order Fulfillment Pipeline</h2>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-error rounded-full"></div>
            <span>Bottleneck</span>
          </div>
          <div className="flex items-center space-x-1">
            <Icon name="Clock" size={14} />
            <span>Avg Time</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {funnelData.map((stage, index) => (
          <div
            key={stage.id}
            className="relative cursor-pointer group"
            onClick={() => handleStageClick(stage)}
            onMouseEnter={() => setHoveredStage(stage.id)}
            onMouseLeave={() => setHoveredStage(null)}
          >
            {/* Funnel Stage */}
            <div className="relative">
              <div
                className={`${stage.color} ${stage.textColor} rounded-lg p-4 transition-all duration-300 ${
                  hoveredStage === stage.id ? 'scale-105 shadow-lg' : ''
                } ${stage.bottleneck ? 'ring-2 ring-error ring-opacity-50' : ''}`}
                style={{
                  width: `${Math.max(stage.percentage, 20)}%`,
                  minWidth: '300px'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Icon name={stage.icon} size={20} />
                    <div>
                      <h3 className="font-medium">{stage.label}</h3>
                      <p className="text-sm opacity-90">
                        {stage.count.toLocaleString('en-IN')} orders • {stage.avgTime}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold">{stage.percentage}%</div>
                    {stage.conversionRate && (
                      <div className="text-sm opacity-90">
                        {stage.conversionRate}% conversion
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottleneck Indicator */}
                {stage.bottleneck && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-error rounded-full flex items-center justify-center">
                    <Icon name="AlertTriangle" size={14} color="white" />
                  </div>
                )}
              </div>

              {/* Connection Arrow */}
              {index < funnelData.length - 1 && (
                <div className="absolute left-1/2 -bottom-2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-muted"></div>
              )}
            </div>

            {/* Hover Details */}
            {hoveredStage === stage.id && (
              <div className="absolute left-full top-0 ml-4 w-64 bg-popover border border-border rounded-lg p-4 modal-shadow z-10">
                <h4 className="font-medium text-popover-foreground mb-2">{stage.label} Details</h4>
                <div className="space-y-2 text-sm text-popover-foreground">
                  <div className="flex justify-between">
                    <span>Orders:</span>
                    <span className="font-medium">{stage.count.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completion Rate:</span>
                    <span className="font-medium">{stage.percentage}%</span>
                  </div>
                  {stage.conversionRate && (
                    <div className="flex justify-between">
                      <span>Stage Conversion:</span>
                      <span className="font-medium">{stage.conversionRate}%</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Avg Processing Time:</span>
                    <span className="font-medium">{stage.avgTime}</span>
                  </div>
                  {stage.bottleneck && (
                    <div className="mt-2 p-2 bg-error/10 rounded text-error text-xs">
                      <Icon name="AlertTriangle" size={12} className="inline mr-1" />
                      Bottleneck detected - Review process
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-foreground">2.4 hrs</div>
            <div className="text-sm text-muted-foreground">Avg Total Time</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-success">92.1%</div>
            <div className="text-sm text-muted-foreground">End-to-End Success</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-warning">1</div>
            <div className="text-sm text-muted-foreground">Active Bottlenecks</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderFulfillmentFunnel;