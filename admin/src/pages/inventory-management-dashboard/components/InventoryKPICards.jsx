import React from 'react';
import Icon from '../../../components/AppIcon';

const InventoryKPICards = ({ kpiData }) => {
  const kpiCards = [
    {
      id: 'total-skus',
      title: 'Total SKUs',
      value: kpiData.totalSKUs,
      change: kpiData.skuChange,
      changeType: kpiData.skuChangeType,
      icon: 'Package',
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      id: 'stock-turnover',
      title: 'Stock Turnover Ratio',
      value: `${kpiData.stockTurnover}x`,
      change: kpiData.turnoverChange,
      changeType: kpiData.turnoverChangeType,
      icon: 'RotateCcw',
      color: 'text-success',
      bgColor: 'bg-success/10'
    },
    {
      id: 'fulfillment-rate',
      title: 'Fulfillment Rate',
      value: `${kpiData.fulfillmentRate}%`,
      change: kpiData.fulfillmentChange,
      changeType: kpiData.fulfillmentChangeType,
      icon: 'CheckCircle',
      color: 'text-accent',
      bgColor: 'bg-accent/10'
    },
    {
      id: 'warehouse-utilization',
      title: 'Warehouse Utilization',
      value: `${kpiData.warehouseUtilization}%`,
      change: kpiData.utilizationChange,
      changeType: kpiData.utilizationChangeType,
      icon: 'Building',
      color: 'text-secondary',
      bgColor: 'bg-secondary/10'
    }
  ];

  const getChangeIcon = (changeType) => {
    switch (changeType) {
      case 'increase': return 'TrendingUp';
      case 'decrease': return 'TrendingDown';
      default: return 'Minus';
    }
  };

  const getChangeColor = (changeType) => {
    switch (changeType) {
      case 'increase': return 'text-success';
      case 'decrease': return 'text-error';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpiCards.map((card) => (
        <div
          key={card.id}
          className="bg-card rounded-lg border border-border p-6 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-lg ${card.bgColor} flex items-center justify-center`}>
              <Icon name={card.icon} size={24} className={card.color} />
            </div>
            <div className={`flex items-center space-x-1 text-sm ${getChangeColor(card.changeType)}`}>
              <Icon name={getChangeIcon(card.changeType)} size={16} />
              <span className="font-medium">{card.change}</span>
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-foreground">{card.value}</h3>
            <p className="text-sm text-muted-foreground">{card.title}</p>
          </div>

          {/* Progress Bar for Percentage Values */}
          {(card.id === 'fulfillment-rate' || card.id === 'warehouse-utilization') && (
            <div className="mt-4">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    card.id === 'fulfillment-rate' ? 'bg-accent' : 'bg-secondary'
                  }`}
                  style={{
                    width: `${card.id === 'fulfillment-rate' ? kpiData.fulfillmentRate : kpiData.warehouseUtilization}%`
                  }}
                ></div>
              </div>
            </div>
          )}

          {/* Additional Context */}
          <div className="mt-3 text-xs text-muted-foreground">
            {card.id === 'total-skus' && 'Active products in inventory'}
            {card.id === 'stock-turnover' && 'Times inventory sold per year'}
            {card.id === 'fulfillment-rate' && 'Orders fulfilled on time'}
            {card.id === 'warehouse-utilization' && 'Storage capacity used'}
          </div>
        </div>
      ))}
    </div>
  );
};

export default InventoryKPICards;