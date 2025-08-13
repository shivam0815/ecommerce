import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
// Add your imports here
import ExecutiveOverviewDashboard from "pages/executive-overview-dashboard";
import OrderFulfillmentAnalyticsDashboard from "pages/order-fulfillment-analytics-dashboard";
import RevenuePerformanceAnalyticsDashboard from "pages/revenue-performance-analytics-dashboard";
import InventoryManagementDashboard from "pages/inventory-management-dashboard";
import NotFound from "pages/NotFound";

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <RouterRoutes>
        {/* Define your routes here */}
        <Route path="/" element={<ExecutiveOverviewDashboard />} />
        <Route path="/executive-overview-dashboard" element={<ExecutiveOverviewDashboard />} />
        <Route path="/order-fulfillment-analytics-dashboard" element={<OrderFulfillmentAnalyticsDashboard />} />
        <Route path="/revenue-performance-analytics-dashboard" element={<RevenuePerformanceAnalyticsDashboard />} />
        <Route path="/inventory-management-dashboard" element={<InventoryManagementDashboard />} />
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;