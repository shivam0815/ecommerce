import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import DashboardNavigation from '../../components/ui/DashboardNavigation';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import ConnectionStatusIndicator from '../../components/ui/ConnectionStatusIndicator';
import CriticalAlertsBar from './components/CriticalAlertsBar';
import InventoryFilters from './components/InventoryFilters';
import InventoryKPICards from './components/InventoryKPICards';
import InventoryHeatmap from './components/InventoryHeatmap';
import LowStockAlerts from './components/LowStockAlerts';
import InventoryDataGrid from './components/InventoryDataGrid';

const InventoryManagementDashboard = () => {
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [filters, setFilters] = useState({
    warehouse: 'all',
    category: 'all',
    stockStatus: 'all',
    supplier: 'all',
    dateRange: '7d'
  });

  // Mock KPI Data
  const kpiData = {
    totalSKUs: "2,847",
    skuChange: "+12",
    skuChangeType: "increase",
    stockTurnover: "4.2",
    turnoverChange: "+0.3",
    turnoverChangeType: "increase",
    fulfillmentRate: 94,
    fulfillmentChange: "+2.1%",
    fulfillmentChangeType: "increase",
    warehouseUtilization: 78,
    utilizationChange: "+5.2%",
    utilizationChangeType: "increase"
  };

  // Mock Critical Alerts Data
  const criticalAlerts = [
    {
      id: 1,
      productName: "iPhone 14 Pro Max Case - Clear",
      sku: "IPC-14PM-CLR-001",
      location: "Warehouse A",
      currentStock: 3,
      severity: "critical",
      message: "Stock critically low - immediate reorder required",
      estimatedStockoutDays: 1,
      onReorder: (item) => console.log('Reordering:', item)
    },
    {
      id: 2,
      productName: "Samsung Galaxy S23 Screen Protector",
      sku: "SGS-S23-SP-001",
      location: "Warehouse B",
      currentStock: 8,
      severity: "critical",
      message: "Below minimum stock threshold",
      estimatedStockoutDays: 2,
      onReorder: (item) => console.log('Reordering:', item)
    },
    {
      id: 3,
      productName: "USB-C Fast Charger 65W",
      sku: "USC-FC-65W-001",
      location: "Store Front",
      currentStock: 15,
      severity: "high",
      message: "Approaching reorder point",
      estimatedStockoutDays: 4,
      onReorder: (item) => console.log('Reordering:', item)
    }
  ];

  // Mock Inventory Data for Heatmap
  const inventoryHeatmapData = [
    { category: 'Mobile Cases', location: 'Warehouse A', stockLevel: 245 },
    { category: 'Mobile Cases', location: 'Warehouse B', stockLevel: 89 },
    { category: 'Mobile Cases', location: 'Warehouse C', stockLevel: 156 },
    { category: 'Mobile Cases', location: 'Store Front', stockLevel: 34 },
    { category: 'Screen Protectors', location: 'Warehouse A', stockLevel: 178 },
    { category: 'Screen Protectors', location: 'Warehouse B', stockLevel: 12 },
    { category: 'Screen Protectors', location: 'Warehouse C', stockLevel: 67 },
    { category: 'Screen Protectors', location: 'Store Front', stockLevel: 23 },
    { category: 'Chargers', location: 'Warehouse A', stockLevel: 134 },
    { category: 'Chargers', location: 'Warehouse B', stockLevel: 78 },
    { category: 'Chargers', location: 'Warehouse C', stockLevel: 45 },
    { category: 'Chargers', location: 'Store Front', stockLevel: 19 },
    { category: 'Cables', location: 'Warehouse A', stockLevel: 289 },
    { category: 'Cables', location: 'Warehouse B', stockLevel: 156 },
    { category: 'Cables', location: 'Warehouse C', stockLevel: 234 },
    { category: 'Cables', location: 'Store Front', stockLevel: 67 },
    { category: 'Power Banks', location: 'Warehouse A', stockLevel: 98 },
    { category: 'Power Banks', location: 'Warehouse B', stockLevel: 34 },
    { category: 'Power Banks', location: 'Warehouse C', stockLevel: 123 },
    { category: 'Power Banks', location: 'Store Front', stockLevel: 12 },
    { category: 'Earphones', location: 'Warehouse A', stockLevel: 167 },
    { category: 'Earphones', location: 'Warehouse B', stockLevel: 89 },
    { category: 'Earphones', location: 'Warehouse C', stockLevel: 45 },
    { category: 'Earphones', location: 'Store Front', stockLevel: 28 },
    { category: 'Speakers', location: 'Warehouse A', stockLevel: 56 },
    { category: 'Speakers', location: 'Warehouse B', stockLevel: 23 },
    { category: 'Speakers', location: 'Warehouse C', stockLevel: 78 },
    { category: 'Speakers', location: 'Store Front', stockLevel: 15 },
    { category: 'Car Accessories', location: 'Warehouse A', stockLevel: 112 },
    { category: 'Car Accessories', location: 'Warehouse B', stockLevel: 67 },
    { category: 'Car Accessories', location: 'Warehouse C', stockLevel: 34 },
    { category: 'Car Accessories', location: 'Store Front', stockLevel: 21 }
  ];

  // Mock Low Stock Items
  const lowStockItems = [
    {
      id: 1,
      productName: "iPhone 14 Pro Max Case - Clear",
      sku: "IPC-14PM-CLR-001",
      category: "Mobile Cases",
      location: "Warehouse A",
      currentStock: 3,
      reorderPoint: 25,
      supplier: "Tech Solutions Ltd.",
      supplierLeadTime: 7,
      lastOrderDate: "15/07/2025",
      avgDailySales: 2.5,
      imageUrl: "https://images.pexels.com/photos/404280/pexels-photo-404280.jpeg"
    },
    {
      id: 2,
      productName: "Samsung Galaxy S23 Screen Protector",
      sku: "SGS-S23-SP-001",
      category: "Screen Protectors",
      location: "Warehouse B",
      currentStock: 8,
      reorderPoint: 30,
      supplier: "Mobile World Inc.",
      supplierLeadTime: 5,
      lastOrderDate: "20/07/2025",
      avgDailySales: 4.2,
      imageUrl: "https://images.pexels.com/photos/1092644/pexels-photo-1092644.jpeg"
    },
    {
      id: 3,
      productName: "USB-C Fast Charger 65W",
      sku: "USC-FC-65W-001",
      category: "Chargers",
      location: "Store Front",
      currentStock: 15,
      reorderPoint: 40,
      supplier: "Accessory Hub",
      supplierLeadTime: 10,
      lastOrderDate: "18/07/2025",
      avgDailySales: 3.8,
      imageUrl: "https://images.pexels.com/photos/163117/phone-old-year-built-1955-163117.jpeg"
    },
    {
      id: 4,
      productName: "Wireless Power Bank 10000mAh",
      sku: "WPB-10K-001",
      category: "Power Banks",
      location: "Warehouse C",
      currentStock: 12,
      reorderPoint: 35,
      supplier: "Digital Depot",
      supplierLeadTime: 8,
      lastOrderDate: "22/07/2025",
      avgDailySales: 2.1,
      imageUrl: "https://images.pexels.com/photos/163117/phone-old-year-built-1955-163117.jpeg"
    },
    {
      id: 5,
      productName: "Bluetooth Earbuds Pro",
      sku: "BTE-PRO-001",
      category: "Earphones",
      location: "Warehouse A",
      currentStock: 18,
      reorderPoint: 50,
      supplier: "Tech Solutions Ltd.",
      supplierLeadTime: 12,
      lastOrderDate: "25/07/2025",
      avgDailySales: 5.2,
      imageUrl: "https://images.pexels.com/photos/163117/phone-old-year-built-1955-163117.jpeg"
    }
  ];

  // Mock Detailed Inventory Data
  const inventoryData = [
    {
      id: 1,
      productName: "iPhone 14 Pro Max Case - Clear",
      sku: "IPC-14PM-CLR-001",
      category: "Mobile Cases",
      currentStock: 3,
      reorderPoint: 25,
      location: "Warehouse A",
      lastUpdated: "30/07/2025 08:00",
      imageUrl: "https://images.pexels.com/photos/404280/pexels-photo-404280.jpeg"
    },
    {
      id: 2,
      productName: "Samsung Galaxy S23 Screen Protector",
      sku: "SGS-S23-SP-001",
      category: "Screen Protectors",
      currentStock: 8,
      reorderPoint: 30,
      location: "Warehouse B",
      lastUpdated: "30/07/2025 07:45",
      imageUrl: "https://images.pexels.com/photos/1092644/pexels-photo-1092644.jpeg"
    },
    {
      id: 3,
      productName: "USB-C Fast Charger 65W",
      sku: "USC-FC-65W-001",
      category: "Chargers",
      currentStock: 15,
      reorderPoint: 40,
      location: "Store Front",
      lastUpdated: "30/07/2025 08:05",
      imageUrl: "https://images.pexels.com/photos/163117/phone-old-year-built-1955-163117.jpeg"
    },
    {
      id: 4,
      productName: "Lightning Cable 2m",
      sku: "LC-2M-001",
      category: "Cables",
      currentStock: 156,
      reorderPoint: 50,
      location: "Warehouse A",
      lastUpdated: "30/07/2025 07:30",
      imageUrl: "https://images.pexels.com/photos/163117/phone-old-year-built-1955-163117.jpeg"
    },
    {
      id: 5,
      productName: "Wireless Power Bank 10000mAh",
      sku: "WPB-10K-001",
      category: "Power Banks",
      currentStock: 12,
      reorderPoint: 35,
      location: "Warehouse C",
      lastUpdated: "30/07/2025 08:02",
      imageUrl: "https://images.pexels.com/photos/163117/phone-old-year-built-1955-163117.jpeg"
    },
    {
      id: 6,
      productName: "Bluetooth Earbuds Pro",
      sku: "BTE-PRO-001",
      category: "Earphones",
      currentStock: 18,
      reorderPoint: 50,
      location: "Warehouse A",
      lastUpdated: "30/07/2025 07:55",
      imageUrl: "https://images.pexels.com/photos/163117/phone-old-year-built-1955-163117.jpeg"
    },
    {
      id: 7,
      productName: "Portable Bluetooth Speaker",
      sku: "PBS-001",
      category: "Speakers",
      currentStock: 89,
      reorderPoint: 30,
      location: "Warehouse B",
      lastUpdated: "30/07/2025 08:01",
      imageUrl: "https://images.pexels.com/photos/163117/phone-old-year-built-1955-163117.jpeg"
    },
    {
      id: 8,
      productName: "Car Phone Mount Magnetic",
      sku: "CPM-MAG-001",
      category: "Car Accessories",
      currentStock: 67,
      reorderPoint: 25,
      location: "Warehouse C",
      lastUpdated: "30/07/2025 07:40",
      imageUrl: "https://images.pexels.com/photos/163117/phone-old-year-built-1955-163117.jpeg"
    },
    {
      id: 9,
      productName: "iPhone 13 Tempered Glass",
      sku: "I13-TG-001",
      category: "Screen Protectors",
      currentStock: 234,
      reorderPoint: 60,
      location: "Warehouse A",
      lastUpdated: "30/07/2025 08:03",
      imageUrl: "https://images.pexels.com/photos/1092644/pexels-photo-1092644.jpeg"
    },
    {
      id: 10,
      productName: "OnePlus 11 Silicone Case",
      sku: "OP11-SC-001",
      category: "Mobile Cases",
      currentStock: 145,
      reorderPoint: 40,
      location: "Store Front",
      lastUpdated: "30/07/2025 07:50",
      imageUrl: "https://images.pexels.com/photos/404280/pexels-photo-404280.jpeg"
    }
  ];

  // Auto-refresh data every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    console.log('Filters changed:', newFilters);
  };

  const handleCategoryFilter = (category) => {
    setFilters(prev => ({ ...prev, category: category || 'all' }));
  };

  const handleReorderAll = (items) => {
    console.log('Reordering all critical items:', items);
  };

  const handleDismissAlert = (alertId) => {
    console.log('Dismissing alert:', alertId);
  };

  const handleReorderItem = (item) => {
    console.log('Reordering item:', item);
  };

  const handleBulkAction = (action, selectedItems) => {
    console.log('Bulk action:', action, 'Items:', selectedItems);
  };

  const handleItemAction = (action, item) => {
    console.log('Item action:', action, 'Item:', item);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <DashboardNavigation />
      <NavigationBreadcrumb filterState={filters} />
      
      <main className="px-6 py-6 space-y-6">
        {/* Connection Status */}
        <div className="flex justify-end">
          <ConnectionStatusIndicator 
            connectionState="connected" 
            lastUpdate={lastUpdate} 
          />
        </div>

        {/* Critical Alerts Bar */}
        <CriticalAlertsBar
          criticalAlerts={criticalAlerts}
          onReorderAll={handleReorderAll}
          onDismissAlert={handleDismissAlert}
        />

        {/* Filters */}
        <InventoryFilters
          onFiltersChange={handleFiltersChange}
          activeFilters={filters}
        />

        {/* KPI Cards */}
        <InventoryKPICards kpiData={kpiData} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-16 gap-6">
          {/* Inventory Heatmap */}
          <div className="lg:col-span-10">
            <InventoryHeatmap
              inventoryData={inventoryHeatmapData}
              onCategoryFilter={handleCategoryFilter}
            />
          </div>

          {/* Low Stock Alerts */}
          <div className="lg:col-span-6">
            <LowStockAlerts
              lowStockItems={lowStockItems}
              onReorder={handleReorderItem}
            />
          </div>
        </div>

        {/* Detailed Inventory Grid */}
        <InventoryDataGrid
          inventoryData={inventoryData}
          onBulkAction={handleBulkAction}
          onItemAction={handleItemAction}
        />
      </main>
    </div>
  );
};

export default InventoryManagementDashboard;