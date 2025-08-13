import React from 'react';
import Icon from '../../../components/AppIcon';

const FulfillmentKPICards = () => {
  const kpiData = [
    {
      id: 'total-orders',
      title: 'Total Orders',
      value: '2,847',
      change: '+12.5%',
      changeType: 'positive',
      icon: 'Package',
      description: 'Orders processed today',
      color: 'text-primary'
    },
    {
      id: 'avg-processing-time',
      title: 'Avg Processing Time',
      value: '2.4 hrs',
      change: '-8.2%',
      changeType: 'positive',
      icon: 'Clock',
      description: 'From order to ship',
      color: 'text-secondary'
    },
    {
      id: 'shipping-accuracy',
      title: 'Shipping Accuracy',
      value: '98.7%',
      change: '+0.3%',
      changeType: 'positive',
      icon: 'Target',
      description: 'Correct address delivery',
      color: 'text-success'
    },
    {
      id: 'delivery-success',
      title: 'Delivery Success Rate',
      value: '96.2%',
      change: '+1.8%',
      changeType: 'positive',
      icon: 'CheckCircle',
      description: 'First attempt delivery',
      color: 'text-success'
    },
    {
      id: 'label-generation',
      title: 'Labels Generated',
      value: '3,156',
      change: '+15.7%',
      changeType: 'positive',
      icon: 'FileText',
      description: 'Shipping labels today',
      color: 'text-accent'
    },
    {
      id: 'cost-per-shipment',
      title: 'Cost per Shipment',
      value: '₹47.50',
      change: '-2.1%',
      changeType: 'positive',
      icon: 'IndianRupee',
      description: 'Average shipping cost',
      color: 'text-warning'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpiData.map((kpi) => (
        <div
          key={kpi.id}
          className="bg-card border border-border rounded-lg p-4 dashboard-shadow hover:shadow-lg transition-smooth"
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${kpi.color}`}>
              <Icon name={kpi.icon} size={20} />
            </div>
            <div className={`flex items-center space-x-1 text-xs font-medium ${
              kpi.changeType === 'positive' ? 'text-success' : 'text-error'
            }`}>
              <Icon 
                name={kpi.changeType === 'positive' ? 'TrendingUp' : 'TrendingDown'} 
                size={12} 
              />
              <span>{kpi.change}</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-foreground">{kpi.value}</h3>
            <p className="text-sm font-medium text-foreground">{kpi.title}</p>
            <p className="text-xs text-muted-foreground">{kpi.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FulfillmentKPICards;