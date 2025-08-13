import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';

const InventoryDataGrid = ({ inventoryData, onBulkAction, onItemAction }) => {
  const [selectedItems, setSelectedItems] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'productName', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedItems(inventoryData.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId, checked) => {
    if (checked) {
      setSelectedItems([...selectedItems, itemId]);
    } else {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...inventoryData].sort((a, b) => {
    if (sortConfig.direction === 'asc') {
      return a[sortConfig.key] > b[sortConfig.key] ? 1 : -1;
    }
    return a[sortConfig.key] < b[sortConfig.key] ? 1 : -1;
  });

  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(inventoryData.length / itemsPerPage);

  const getStockStatus = (currentStock, reorderPoint) => {
    if (currentStock === 0) return { label: 'Out of Stock', color: 'text-error bg-error/10' };
    if (currentStock < reorderPoint * 0.5) return { label: 'Critical', color: 'text-error bg-error/10' };
    if (currentStock < reorderPoint) return { label: 'Low Stock', color: 'text-warning bg-warning/10' };
    if (currentStock > reorderPoint * 3) return { label: 'Overstock', color: 'text-primary bg-primary/10' };
    return { label: 'In Stock', color: 'text-success bg-success/10' };
  };

  const handleBulkAction = (action) => {
    onBulkAction(action, selectedItems);
    setSelectedItems([]);
  };

  return (
    <div className="bg-card rounded-lg border border-border">
      {/* Header with Bulk Actions */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Inventory Details</h3>
            <p className="text-sm text-muted-foreground">
              {inventoryData.length} total items • {selectedItems.length} selected
            </p>
          </div>
          
          {selectedItems.length > 0 && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('reorder')}
                iconName="ShoppingCart"
              >
                Bulk Reorder ({selectedItems.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('adjust')}
                iconName="Edit"
              >
                Bulk Adjust
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('transfer')}
                iconName="ArrowRightLeft"
              >
                Bulk Transfer
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30">
            <tr>
              <th className="w-12 p-4">
                <input
                  type="checkbox"
                  checked={selectedItems.length === inventoryData.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-border"
                />
              </th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Product</th>
              <th 
                className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-smooth"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center space-x-1">
                  <span>Category</span>
                  <Icon name="ArrowUpDown" size={14} />
                </div>
              </th>
              <th 
                className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-smooth"
                onClick={() => handleSort('currentStock')}
              >
                <div className="flex items-center space-x-1">
                  <span>Current Stock</span>
                  <Icon name="ArrowUpDown" size={14} />
                </div>
              </th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th 
                className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-smooth"
                onClick={() => handleSort('location')}
              >
                <div className="flex items-center space-x-1">
                  <span>Location</span>
                  <Icon name="ArrowUpDown" size={14} />
                </div>
              </th>
              <th 
                className="text-left p-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-smooth"
                onClick={() => handleSort('lastUpdated')}
              >
                <div className="flex items-center space-x-1">
                  <span>Last Updated</span>
                  <Icon name="ArrowUpDown" size={14} />
                </div>
              </th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedData.map((item) => {
              const stockStatus = getStockStatus(item.currentStock, item.reorderPoint);
              const isSelected = selectedItems.includes(item.id);

              return (
                <tr 
                  key={item.id} 
                  className={`hover:bg-muted/30 transition-smooth ${isSelected ? 'bg-primary/5' : ''}`}
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                      className="rounded border-border"
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <Image
                          src={item.imageUrl}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {item.productName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          SKU: {item.sku}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-foreground">{item.category}</span>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      <div className="font-medium text-foreground">{item.currentStock}</div>
                      <div className="text-xs text-muted-foreground">
                        Reorder: {item.reorderPoint}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${stockStatus.color}`}>
                      {stockStatus.label}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-foreground">{item.location}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">{item.lastUpdated}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onItemAction('reorder', item)}
                        className="p-1 hover:bg-muted rounded transition-smooth"
                        title="Reorder"
                      >
                        <Icon name="ShoppingCart" size={16} className="text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        onClick={() => onItemAction('adjust', item)}
                        className="p-1 hover:bg-muted rounded transition-smooth"
                        title="Adjust Stock"
                      >
                        <Icon name="Edit" size={16} className="text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        onClick={() => onItemAction('transfer', item)}
                        className="p-1 hover:bg-muted rounded transition-smooth"
                        title="Transfer"
                      >
                        <Icon name="ArrowRightLeft" size={16} className="text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        onClick={() => onItemAction('details', item)}
                        className="p-1 hover:bg-muted rounded transition-smooth"
                        title="View Details"
                      >
                        <Icon name="Eye" size={16} className="text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, inventoryData.length)} of {inventoryData.length} items
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              iconName="ChevronLeft"
            >
              Previous
            </Button>
            <span className="text-sm text-foreground px-3 py-1">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              iconName="ChevronRight"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryDataGrid;