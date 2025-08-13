import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';

const RealTimeOrderFeed = () => {
  const [orders, setOrders] = useState([]);

  const mockOrders = [
    {
      id: 'ORD-2025-001234',
      customer: 'Rajesh Kumar',
      status: 'processing',
      priority: 'high',
      items: 'iPhone 15 Case + Screen Guard',
      timestamp: new Date(Date.now() - 300000),
      estimatedCompletion: '15 min',
      location: 'Mumbai Warehouse',
      courier: 'Delhivery'
    },
    {
      id: 'ORD-2025-001235',
      customer: 'Priya Sharma',
      status: 'picked',
      priority: 'normal',
      items: 'Samsung Galaxy Charger',
      timestamp: new Date(Date.now() - 600000),
      estimatedCompletion: '8 min',
      location: 'Delhi Warehouse',
      courier: 'DTDC'
    },
    {
      id: 'ORD-2025-001236',
      customer: 'Amit Patel',
      status: 'shipped',
      priority: 'normal',
      items: 'OnePlus Earbuds + Case',
      timestamp: new Date(Date.now() - 900000),
      estimatedCompletion: 'In Transit',
      location: 'Bangalore Hub',
      courier: 'Blue Dart'
    },
    {
      id: 'ORD-2025-001237',
      customer: 'Sneha Reddy',
      status: 'pending',
      priority: 'urgent',
      items: 'Mi Power Bank 20000mAh',
      timestamp: new Date(Date.now() - 120000),
      estimatedCompletion: '25 min',
      location: 'Hyderabad Warehouse',
      courier: 'FedEx'
    },
    {
      id: 'ORD-2025-001238',
      customer: 'Vikram Singh',
      status: 'label_generated',
      priority: 'normal',
      items: 'Realme Wireless Charger',
      timestamp: new Date(Date.now() - 1800000),
      estimatedCompletion: '5 min',
      location: 'Pune Warehouse',
      courier: 'Ecom Express'
    }
  ];

  useEffect(() => {
    setOrders(mockOrders);
    
    // Simulate real-time updates
    const interval = setInterval(() => {
      setOrders(prevOrders => {
        const updatedOrders = [...prevOrders];
        const randomIndex = Math.floor(Math.random() * updatedOrders.length);
        const statuses = ['pending', 'processing', 'picked', 'label_generated', 'shipped'];
        const currentStatusIndex = statuses.indexOf(updatedOrders[randomIndex].status);
        
        if (currentStatusIndex < statuses.length - 1) {
          updatedOrders[randomIndex] = {
            ...updatedOrders[randomIndex],
            status: statuses[currentStatusIndex + 1],
            timestamp: new Date()
          };
        }
        
        return updatedOrders;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const getStatusConfig = (status) => {
    const configs = {
      pending: { color: 'text-warning', bg: 'bg-warning/10', icon: 'Clock', label: 'Pending' },
      processing: { color: 'text-primary', bg: 'bg-primary/10', icon: 'Loader2', label: 'Processing' },
      picked: { color: 'text-secondary', bg: 'bg-secondary/10', icon: 'PackageCheck', label: 'Picked' },
      label_generated: { color: 'text-accent', bg: 'bg-accent/10', icon: 'FileText', label: 'Label Ready' },
      shipped: { color: 'text-success', bg: 'bg-success/10', icon: 'Truck', label: 'Shipped' }
    };
    return configs[status] || configs.pending;
  };

  const getPriorityConfig = (priority) => {
    const configs = {
      urgent: { color: 'text-error', bg: 'bg-error/10', icon: 'AlertTriangle' },
      high: { color: 'text-warning', bg: 'bg-warning/10', icon: 'AlertCircle' },
      normal: { color: 'text-muted-foreground', bg: 'bg-muted/50', icon: 'Circle' }
    };
    return configs[priority] || configs.normal;
  };

  const formatTimeAgo = (timestamp) => {
    const diff = Math.floor((new Date() - timestamp) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Real-Time Order Feed</h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
          <span className="text-xs text-muted-foreground">Live Updates</span>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {orders.map((order) => {
          const statusConfig = getStatusConfig(order.status);
          const priorityConfig = getPriorityConfig(order.priority);

          return (
            <div
              key={order.id}
              className="border border-border rounded-lg p-3 hover:bg-muted/30 transition-smooth"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-lg ${statusConfig.bg} flex items-center justify-center`}>
                    <Icon name={statusConfig.icon} size={14} className={statusConfig.color} />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-foreground">{order.id}</h4>
                    <p className="text-xs text-muted-foreground">{order.customer}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-1">
                  <div className={`w-6 h-6 rounded-full ${priorityConfig.bg} flex items-center justify-center`}>
                    <Icon name={priorityConfig.icon} size={10} className={priorityConfig.color} />
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTimeAgo(order.timestamp)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-foreground">{order.items}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{order.location}</span>
                  <span>{order.courier}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${statusConfig.bg} ${statusConfig.color} font-medium`}>
                    {statusConfig.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ETA: {order.estimatedCompletion}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {orders.filter(o => o.priority === 'urgent').length} urgent orders
          </span>
          <button className="text-primary hover:text-primary/80 transition-smooth">
            View All Orders →
          </button>
        </div>
      </div>
    </div>
  );
};

export default RealTimeOrderFeed;