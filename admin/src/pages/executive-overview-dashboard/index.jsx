import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import DashboardNavigation from '../../components/ui/DashboardNavigation';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import ConnectionStatusIndicator from '../../components/ui/ConnectionStatusIndicator';
import DashboardHeader from './components/DashboardHeader';
import KPICard from './components/KPICard';
import RevenueChart from './components/RevenueChart';
import TopProductsTable from './components/TopProductsTable';
import MetricCard from './components/MetricCard';

const ExecutiveOverviewDashboard = () => {
  const [dateRange, setDateRange] = useState('week');
  const [currency, setCurrency] = useState('INR');
  const [refreshInterval, setRefreshInterval] = useState(15);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Mock data for KPI cards
  const kpiData = [
    {
      title: "Total Revenue",
      value: 2847650,
      change: 12.5,
      changeType: "positive",
      icon: "TrendingUp",
      currency: true,
      sparklineData: [45000, 52000, 48000, 61000, 55000, 67000, 72000]
    },
    {
      title: "Active Orders",
      value: 1247,
      change: 8.3,
      changeType: "positive",
      icon: "ShoppingCart",
      sparklineData: [120, 135, 128, 142, 138, 155, 162]
    },
    {
      title: "Inventory Value",
      value: 5642300,
      change: -2.1,
      changeType: "negative",
      icon: "Package",
      currency: true,
      sparklineData: [580000, 575000, 582000, 578000, 571000, 568000, 564000]
    },
    {
      title: "Profit Margin",
      value: "18.7%",
      change: 3.2,
      changeType: "positive",
      icon: "Percent",
      sparklineData: [16.2, 16.8, 17.1, 17.5, 18.0, 18.4, 18.7]
    }
  ];

  // Mock data for revenue chart
  const revenueChartData = [
    { date: "Jan 24", revenue: 65000, orders: 145 },
    { date: "Jan 25", revenue: 72000, orders: 162 },
    { date: "Jan 26", revenue: 68000, orders: 158 },
    { date: "Jan 27", revenue: 85000, orders: 189 },
    { date: "Jan 28", revenue: 78000, orders: 175 },
    { date: "Jan 29", revenue: 92000, orders: 203 },
    { date: "Jan 30", revenue: 88000, orders: 195 }
  ];

  // Mock data for top products
  const topProductsData = [
    {
      id: 1,
      name: "iPhone 15 Pro Max Case",
      category: "Phone Cases",
      image: "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=100&h=100&fit=crop",
      revenue: 245000,
      units: 1250,
      contribution: 8.6,
      growth: 15.2
    },
    {
      id: 2,
      name: "Samsung Galaxy Earbuds",
      category: "Audio Accessories",
      image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=100&h=100&fit=crop",
      revenue: 198000,
      units: 890,
      contribution: 6.9,
      growth: 22.1
    },
    {
      id: 3,
      name: "Wireless Charging Pad",
      category: "Chargers",
      image: "https://images.unsplash.com/photo-1609592806444-7e6c4b5b7b8a?w=100&h=100&fit=crop",
      revenue: 156000,
      units: 1560,
      contribution: 5.5,
      growth: -3.2
    },
    {
      id: 4,
      name: "USB-C Cable 3m",
      category: "Cables",
      image: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=100&h=100&fit=crop",
      revenue: 134000,
      units: 2680,
      contribution: 4.7,
      growth: 8.9
    },
    {
      id: 5,
      name: "Phone Screen Protector",
      category: "Protection",
      image: "https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=100&h=100&fit=crop",
      revenue: 112000,
      units: 3360,
      contribution: 3.9,
      growth: 12.4
    }
  ];

  // Mock data for metric cards
  const metricsData = [
    {
      title: "Customer Acquisition Cost",
      value: "₹285",
      change: -5.2,
      changeType: "positive",
      icon: "Users",
      status: "good",
      description: "Cost per new customer acquired through marketing channels"
    },
    {
      title: "Average Order Value",
      value: "₹2,284",
      change: 7.8,
      changeType: "positive",
      icon: "ShoppingBag",
      status: "good",
      description: "Average value of orders placed by customers"
    },
    {
      title: "Return Rate",
      value: "3.2%",
      change: 1.1,
      changeType: "negative",
      icon: "RotateCcw",
      status: "warning",
      description: "Percentage of orders returned by customers"
    }
  ];

  // Auto-refresh effect
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleDateRangeChange = (newRange) => {
    setDateRange(newRange);
    setLastUpdated(new Date());
  };

  const handleCurrencyChange = (newCurrency) => {
    setCurrency(newCurrency);
  };

  const handleRefreshIntervalChange = (newInterval) => {
    setRefreshInterval(newInterval);
  };

  const handleChartDrillDown = (dataPoint) => {
    console.log('Drilling down into:', dataPoint);
    // Implement drill-down functionality
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <DashboardNavigation />
      <NavigationBreadcrumb />
      
      <main className="flex-1">
        <DashboardHeader
          onDateRangeChange={handleDateRangeChange}
          onCurrencyChange={handleCurrencyChange}
          onRefreshIntervalChange={handleRefreshIntervalChange}
          currentDateRange={dateRange}
          currentCurrency={currency}
          currentRefreshInterval={refreshInterval}
          lastUpdated={lastUpdated}
        />

        <div className="p-6 space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {kpiData.map((kpi, index) => (
              <KPICard
                key={index}
                title={kpi.title}
                value={kpi.value}
                change={kpi.change}
                changeType={kpi.changeType}
                icon={kpi.icon}
                currency={kpi.currency}
                sparklineData={kpi.sparklineData}
              />
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Revenue Chart - Takes 2 columns on xl screens */}
            <div className="xl:col-span-2">
              <RevenueChart 
                data={revenueChartData}
                onDrillDown={handleChartDrillDown}
              />
            </div>

            {/* Top Products Table - Takes 1 column on xl screens */}
            <div className="xl:col-span-1">
              <TopProductsTable products={topProductsData} />
            </div>
          </div>

          {/* Bottom Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {metricsData.map((metric, index) => (
              <MetricCard
                key={index}
                title={metric.title}
                value={metric.value}
                change={metric.change}
                changeType={metric.changeType}
                icon={metric.icon}
                status={metric.status}
                description={metric.description}
              />
            ))}
          </div>

          {/* Connection Status */}
          <div className="flex justify-end">
            <ConnectionStatusIndicator
              connectionState="connected"
              lastUpdate={lastUpdated}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExecutiveOverviewDashboard;