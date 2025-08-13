import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const PromotionalCampaignTable = () => {
  const [sortField, setSortField] = useState('roi');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');

  const campaignData = [
    {
      id: 'CAMP001',
      name: 'Summer Mobile Sale',
      type: 'Discount',
      status: 'active',
      startDate: '2024-07-01',
      endDate: '2024-07-31',
      budget: 500000,
      spent: 425000,
      revenue: 2850000,
      orders: 1250,
      roi: 570,
      conversionRate: 8.5,
      engagement: 12500,
      abTestWinner: 'Variant A'
    },
    {
      id: 'CAMP002',
      name: 'Accessory Bundle Offer',
      type: 'Bundle',
      status: 'active',
      startDate: '2024-07-15',
      endDate: '2024-08-15',
      budget: 300000,
      spent: 180000,
      revenue: 1620000,
      orders: 890,
      roi: 800,
      conversionRate: 12.3,
      engagement: 8900,
      abTestWinner: 'Variant B'
    },
    {
      id: 'CAMP003',
      name: 'Flash Friday Sale',
      type: 'Flash Sale',
      status: 'completed',
      startDate: '2024-07-26',
      endDate: '2024-07-26',
      budget: 150000,
      spent: 150000,
      revenue: 980000,
      orders: 650,
      roi: 553,
      conversionRate: 15.2,
      engagement: 4500,
      abTestWinner: 'Variant A'
    },
    {
      id: 'CAMP004',
      name: 'New Customer Welcome',
      type: 'Welcome',
      status: 'active',
      startDate: '2024-07-01',
      endDate: '2024-12-31',
      budget: 200000,
      spent: 120000,
      revenue: 720000,
      orders: 480,
      roi: 500,
      conversionRate: 6.8,
      engagement: 3200,
      abTestWinner: 'Testing'
    },
    {
      id: 'CAMP005',
      name: 'Monsoon Special',
      type: 'Seasonal',
      status: 'scheduled',
      startDate: '2024-08-01',
      endDate: '2024-08-31',
      budget: 400000,
      spent: 0,
      revenue: 0,
      orders: 0,
      roi: 0,
      conversionRate: 0,
      engagement: 0,
      abTestWinner: 'Pending'
    }
  ];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...campaignData].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    if (typeof aVal === 'string') {
      return aVal.localeCompare(bVal) * multiplier;
    }
    return (aVal - bVal) * multiplier;
  });

  const filteredData = sortedData.filter(campaign => 
    filterStatus === 'all' || campaign.status === filterStatus
  );

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: 'bg-success text-success-foreground', label: 'Active' },
      completed: { color: 'bg-muted text-muted-foreground', label: 'Completed' },
      scheduled: { color: 'bg-warning text-warning-foreground', label: 'Scheduled' },
      paused: { color: 'bg-error text-error-foreground', label: 'Paused' }
    };
    
    const config = statusConfig[status] || statusConfig.active;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const SortableHeader = ({ field, children }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-smooth"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          <Icon 
            name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} 
            size={14} 
          />
        )}
      </div>
    </th>
  );

  return (
    <div className="bg-card border border-border rounded-lg dashboard-shadow">
      <div className="p-6 border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Promotional Campaign Performance</h3>
            <p className="text-sm text-muted-foreground">ROI analysis and A/B test results</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              {['all', 'active', 'completed', 'scheduled'].map((status) => (
                <Button
                  key={status}
                  variant={filterStatus === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
            
            <Button variant="outline" size="sm" iconName="Plus">
              New Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30">
            <tr>
              <SortableHeader field="name">Campaign</SortableHeader>
              <SortableHeader field="status">Status</SortableHeader>
              <SortableHeader field="budget">Budget</SortableHeader>
              <SortableHeader field="revenue">Revenue</SortableHeader>
              <SortableHeader field="roi">ROI %</SortableHeader>
              <SortableHeader field="conversionRate">Conversion</SortableHeader>
              <SortableHeader field="orders">Orders</SortableHeader>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                A/B Test
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredData.map((campaign) => (
              <tr key={campaign.id} className="hover:bg-muted/30 transition-smooth">
                <td className="px-4 py-4">
                  <div>
                    <div className="font-medium text-foreground">{campaign.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {campaign.type} • {campaign.id}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(campaign.startDate).toLocaleDateString('en-IN')} - {new Date(campaign.endDate).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  {getStatusBadge(campaign.status)}
                </td>
                <td className="px-4 py-4">
                  <div>
                    <div className="font-medium text-foreground">{formatCurrency(campaign.budget)}</div>
                    <div className="text-sm text-muted-foreground">
                      Spent: {formatCurrency(campaign.spent)}
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div 
                        className="bg-primary h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${(campaign.spent / campaign.budget) * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-foreground">{formatCurrency(campaign.revenue)}</div>
                  <div className="text-sm text-muted-foreground">
                    {campaign.orders.toLocaleString('en-IN')} orders
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className={`font-semibold ${campaign.roi > 400 ? 'text-success' : campaign.roi > 200 ? 'text-warning' : 'text-error'}`}>
                    {campaign.roi}%
                  </div>
                  <div className="flex items-center space-x-1 mt-1">
                    <Icon 
                      name={campaign.roi > 400 ? 'TrendingUp' : 'TrendingDown'} 
                      size={12} 
                      className={campaign.roi > 400 ? 'text-success' : 'text-error'} 
                    />
                    <span className="text-xs text-muted-foreground">vs target</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-foreground">{campaign.conversionRate}%</div>
                  <div className="text-sm text-muted-foreground">
                    {campaign.engagement.toLocaleString('en-IN')} engaged
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-foreground">{campaign.orders.toLocaleString('en-IN')}</div>
                  <div className="text-sm text-muted-foreground">
                    Avg: {campaign.revenue > 0 ? formatCurrency(campaign.revenue / campaign.orders) : '₹0'}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      campaign.abTestWinner === 'Variant A' ? 'bg-green-100 text-green-800' :
                      campaign.abTestWinner === 'Variant B' ? 'bg-blue-100 text-blue-800' :
                      campaign.abTestWinner === 'Testing'? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {campaign.abTestWinner}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm" iconName="Eye" />
                    <Button variant="ghost" size="sm" iconName="Edit" />
                    <Button variant="ghost" size="sm" iconName="MoreHorizontal" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredData.length} of {campaignData.length} campaigns
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" iconName="Download">
              Export
            </Button>
            <Button variant="outline" size="sm" iconName="Filter">
              Advanced Filters
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionalCampaignTable;