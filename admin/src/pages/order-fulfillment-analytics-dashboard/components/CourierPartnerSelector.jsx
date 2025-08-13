import React from 'react';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';

const CourierPartnerSelector = ({ selectedPartners, onPartnersChange }) => {
  const courierOptions = [
    { value: 'all', label: 'All Partners' },
    { value: 'delhivery', label: 'Delhivery', description: '2,156 orders' },
    { value: 'dtdc', label: 'DTDC', description: '1,847 orders' },
    { value: 'bluedart', label: 'Blue Dart', description: '1,234 orders' },
    { value: 'fedex', label: 'FedEx', description: '892 orders' },
    { value: 'aramex', label: 'Aramex', description: '567 orders' },
    { value: 'ecom', label: 'Ecom Express', description: '445 orders' }
  ];

  return (
    <div className="flex items-center space-x-2">
      <Icon name="Truck" size={16} className="text-muted-foreground" />
      <Select
        options={courierOptions}
        value={selectedPartners}
        onChange={onPartnersChange}
        placeholder="Select courier partners"
        multiple
        searchable
        clearable
        className="min-w-[200px]"
      />
    </div>
  );
};

export default CourierPartnerSelector;