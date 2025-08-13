import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import DashboardNavigation from '../../components/ui/DashboardNavigation';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import ConnectionStatusIndicator from '../../components/ui/ConnectionStatusIndicator';
import OrderStatusFilters from './components/OrderStatusFilters';
import DateRangeSelector from './components/DateRangeSelector';
import CourierPartnerSelector from './components/CourierPartnerSelector';
import FulfillmentKPICards from './components/FulfillmentKPICards';
import OrderFulfillmentFunnel from './components/OrderFulfillmentFunnel';
import RealTimeOrderFeed from './components/RealTimeOrderFeed';
import CourierPerformanceTable from './components/CourierPerformanceTable';
import Icon from '../../components/AppIcon';

const OrderFulfillmentAnalyticsDashboard = () => {
  const [filters, setFilters] = useState({
    status: ['all'],
    dateRange: 'today',
    courierPartners: ['all']
  });
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [connectionState, setConnectionState] = useState('connected');

  useEffect(() => {
    // Simulate data refresh every 10 minutes
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 600000);

    return () => clearInterval(interval);
  }, []);

  const handleStatusFilterChange = (statusId) => {
    setFilters(prev => {
      if (statusId === 'all') {
        return { ...prev, status: ['all'] };
      }
      
      const newStatus = prev.status.includes('all') 
        ? [statusId]
        : prev.status.includes(statusId)
          ? prev.status.filter(s => s !== statusId)
          : [...prev.status.filter(s => s !== 'all'), statusId];
      
      return { ...prev, status: newStatus.length ? newStatus : ['all'] };
    });
  };

  const handleDateRangeChange = (range) => {
    setFilters(prev => ({ ...prev, dateRange: range }));
  };

  const handleCourierPartnersChange = (partners) => {
    setFilters(prev => ({ ...prev, courierPartners: partners }));
  };

  const handleFunnelStageClick = (stage) => {
    console.log('Funnel stage clicked:', stage);
    // Implement drill-down functionality here
  };

  const handleRefreshData = () => {
    setConnectionState('connecting');
    setTimeout(() => {
      setLastUpdate(new Date());
      setConnectionState('connected');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <DashboardNavigation />
      <NavigationBreadcrumb 
        filterState={{
          dateRange: filters.dateRange,
          category: filters.status.length > 1 ? 'Multiple Status' : filters.status[0],
          drillDown: filters.courierPartners.length > 1 ? 'Multiple Couriers' : null
        }}
      />

      <main className="px-6 py-6 space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Order Fulfillment Analytics</h1>
            <p className="text-muted-foreground">
              Monitor order processing efficiency and identify bottlenecks in real-time
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <ConnectionStatusIndicator 
              connectionState={connectionState}
              lastUpdate={lastUpdate}
            />
            <button
              onClick={handleRefreshData}
              className="flex items-center space-x-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-smooth"
            >
              <Icon name="RefreshCw" size={16} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-2">
                Order Status
              </label>
              <OrderStatusFilters 
                activeFilters={filters.status}
                onFilterChange={handleStatusFilterChange}
              />
            </div>
            
            <div className="lg:w-64">
              <label className="block text-sm font-medium text-foreground mb-2">
                Date Range
              </label>
              <DateRangeSelector
                selectedRange={filters.dateRange}
                onRangeChange={handleDateRangeChange}
              />
            </div>
            
            <div className="lg:w-64">
              <label className="block text-sm font-medium text-foreground mb-2">
                Courier Partners
              </label>
              <CourierPartnerSelector
                selectedPartners={filters.courierPartners}
                onPartnersChange={handleCourierPartnersChange}
              />
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <FulfillmentKPICards />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Fulfillment Funnel - Takes 2 columns on xl screens */}
          <div className="xl:col-span-2">
            <OrderFulfillmentFunnel onStageClick={handleFunnelStageClick} />
          </div>

          {/* Real-time Order Feed - Takes 1 column on xl screens */}
          <div className="xl:col-span-1">
            <RealTimeOrderFeed />
          </div>
        </div>

        {/* Courier Performance Table */}
        <CourierPerformanceTable />

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-smooth">
              <Icon name="FileText" size={20} className="text-primary" />
              <div className="text-left">
                <div className="font-medium text-foreground">Generate Labels</div>
                <div className="text-sm text-muted-foreground">Bulk label creation</div>
              </div>
            </button>
            
            <button className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-smooth">
              <Icon name="AlertTriangle" size={20} className="text-warning" />
              <div className="text-left">
                <div className="font-medium text-foreground">Priority Orders</div>
                <div className="text-sm text-muted-foreground">View urgent shipments</div>
              </div>
            </button>
            
            <button className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-smooth">
              <Icon name="BarChart3" size={20} className="text-success" />
              <div className="text-left">
                <div className="font-medium text-foreground">Performance Report</div>
                <div className="text-sm text-muted-foreground">Detailed analytics</div>
              </div>
            </button>
            
            <button className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-smooth">
              <Icon name="Settings" size={20} className="text-muted-foreground" />
              <div className="text-left">
                <div className="font-medium text-foreground">Configure Alerts</div>
                <div className="text-sm text-muted-foreground">Notification settings</div>
              </div>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Nakoda Mobile Analytics. All rights reserved.
          </div>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>Last updated: {lastUpdate.toLocaleTimeString('en-IN')}</span>
            <span>•</span>
            <span>Data refreshes every 10 minutes</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default OrderFulfillmentAnalyticsDashboard;