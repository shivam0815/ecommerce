import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const OrderStatusFilters = ({ activeFilters, onFilterChange }) => {
  const statusFilters = [
    { id: 'all', label: 'All Orders', icon: 'Package', count: 2847 },
    { id: 'pending', label: 'Pending', icon: 'Clock', count: 156, color: 'text-warning' },
    { id: 'processing', label: 'Processing', icon: 'Loader2', count: 89, color: 'text-primary' },
    { id: 'shipped', label: 'Shipped', icon: 'Truck', count: 234, color: 'text-secondary' },
    { id: 'delivered', label: 'Delivered', icon: 'CheckCircle', count: 2368, color: 'text-success' }
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {statusFilters.map((filter) => (
        <Button
          key={filter.id}
          variant={activeFilters.includes(filter.id) ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange(filter.id)}
          className="flex items-center space-x-2"
        >
          <Icon 
            name={filter.icon} 
            size={16} 
            className={filter.color || 'text-current'} 
          />
          <span>{filter.label}</span>
          <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">
            {filter.count}
          </span>
        </Button>
      ))}
    </div>
  );
};

export default OrderStatusFilters;