import React, { useState } from 'react';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const DateRangeSelector = ({ selectedRange, onRangeChange }) => {
  const [isCustomRange, setIsCustomRange] = useState(false);

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7days', label: 'Last 7 Days' },
    { value: 'last30days', label: 'Last 30 Days' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'thisQuarter', label: 'This Quarter' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const handleRangeChange = (value) => {
    if (value === 'custom') {
      setIsCustomRange(true);
    } else {
      setIsCustomRange(false);
      onRangeChange(value);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Icon name="Calendar" size={16} className="text-muted-foreground" />
      <Select
        options={dateRangeOptions}
        value={selectedRange}
        onChange={handleRangeChange}
        placeholder="Select date range"
        className="min-w-[160px]"
      />
      {isCustomRange && (
        <div className="flex items-center space-x-2">
          <input
            type="date"
            className="px-3 py-2 border border-border rounded-md text-sm"
            defaultValue="2025-07-23"
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="date"
            className="px-3 py-2 border border-border rounded-md text-sm"
            defaultValue="2025-07-30"
          />
          <Button variant="outline" size="sm">
            Apply
          </Button>
        </div>
      )}
    </div>
  );
};

export default DateRangeSelector;