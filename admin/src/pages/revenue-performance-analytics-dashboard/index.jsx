import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import DashboardNavigation from '../../components/ui/DashboardNavigation';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import ConnectionStatusIndicator from '../../components/ui/ConnectionStatusIndicator';

import Button from '../../components/ui/Button';

// Import dashboard components
import DashboardFilters from './components/DashboardFilters';
import RevenueKPICard from './components/RevenueKPICard';
import RevenueChart from './components/RevenueChart';
import CustomerAcquisitionFunnel from './components/CustomerAcquisitionFunnel';
import GeographicSalesMap from './components/GeographicSalesMap';
import PromotionalCampaignTable from './components/PromotionalCampaignTable';

const RevenuePerformanceAnalyticsDashboard = () => {
  const [filters, setFilters] = useState({
    dateRange: '7d',
    comparisonMode: 'period',
    customerSegment: 'all',
    productCategory: 'all',
    channel: 'all',
    campaign: 'all'
  });

  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [isLoading, setIsLoading] = useState(false);

  // Mock KPI data
  const kpiData = [
    {
      title: 'Total Revenue',
      value: 38500000,
      currency: '₹',
      trend: 15.2,
      trendDirection: 'up',
      comparison: { period: 'Last Month', value: 33400000 },
      icon: 'TrendingUp'
    },
    {
      title: 'Customer Lifetime Value',
      value: 24500,
      currency: '₹',
      trend: 8.7,
      trendDirection: 'up',
      comparison: { period: 'Previous Period', value: 22500 },
      icon: 'Users'
    },
    {
      title: 'Promotional ROI',
      value: 485,
      currency: '',
      trend: 22.3,
      trendDirection: 'up',
      comparison: { period: 'Last Campaign', value: 396 },
      icon: 'Target'
    }
  ];

  // Simulate real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 15 * 60 * 1000); // Update every 15 minutes

    return () => clearInterval(interval);
  }, []);

  const handleFiltersChange = (newFilters) => {
    setIsLoading(true);
    setFilters(newFilters);
    
    // Simulate API call delay
    setTimeout(() => {
      setIsLoading(false);
      setLastUpdated(new Date());
    }, 1000);
  };

  const handleExportDashboard = () => {
    console.log('Exporting dashboard data...');
    // Implementation for dashboard export
  };

  const handleRefreshData = () => {
    setIsLoading(true);
    setConnectionStatus('connecting');
    
    setTimeout(() => {
      setIsLoading(false);
      setConnectionStatus('connected');
      setLastUpdated(new Date());
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <DashboardNavigation />
      
      <div className="flex-1">
        <NavigationBreadcrumb 
          filterState={filters}
          onNavigationBack={() => window.history.back()}
        />
        
        <main className="p-6 space-y-6">
          {/* Dashboard Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Revenue & Performance Analytics</h1>
              <p className="text-muted-foreground">
                Comprehensive sales insights and promotional effectiveness measurement
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <ConnectionStatusIndicator 
                connectionState={connectionStatus}
                lastUpdate={lastUpdated}
              />
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshData}
                  loading={isLoading}
                  iconName="RefreshCw"
                >
                  Refresh
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportDashboard}
                  iconName="Download"
                >
                  Export
                </Button>
                
                <Button
                  variant="default"
                  size="sm"
                  iconName="Settings"
                >
                  Configure
                </Button>
              </div>
            </div>
          </div>

          {/* Dashboard Filters */}
          <DashboardFilters onFiltersChange={handleFiltersChange} />

          {/* KPI Cards Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {kpiData.map((kpi, index) => (
              <RevenueKPICard
                key={index}
                title={kpi.title}
                value={kpi.value}
                currency={kpi.currency}
                trend={kpi.trend}
                trendDirection={kpi.trendDirection}
                comparison={kpi.comparison}
                icon={kpi.icon}
                className={isLoading ? 'opacity-50 pointer-events-none' : ''}
              />
            ))}
          </div>

          {/* Main Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart - 8 columns */}
            <div className="lg:col-span-2">
              <RevenueChart />
            </div>
            
            {/* Customer Acquisition Funnel - 4 columns */}
            <div className="lg:col-span-1">
              <CustomerAcquisitionFunnel />
            </div>
          </div>

          {/* Geographic Sales Map */}
          <GeographicSalesMap />

          {/* Promotional Campaign Table */}
          <PromotionalCampaignTable />

          {/* Dashboard Footer */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pt-6 border-t border-border space-y-4 lg:space-y-0">
            <div className="text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })} IST
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" iconName="HelpCircle">
                Help & Support
              </Button>
              <Button variant="ghost" size="sm" iconName="MessageSquare">
                Feedback
              </Button>
              <Button variant="ghost" size="sm" iconName="Share2">
                Share Dashboard
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default RevenuePerformanceAnalyticsDashboard;