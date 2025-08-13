import cron from 'node-cron';
import InventoryService from './InventoryService';
import OrderProcessingService from './OrderProcessingService';

class ScheduleService {
  start() {
    console.log('✅ Starting scheduled services...');

    // ✅ Check low stock daily at 9 AM
    cron.schedule('0 9 * * *', async () => {
      console.log('🔍 Running daily low stock check...');
      await InventoryService.checkLowStock();
    });

    // ✅ Cleanup old pipelines weekly
    cron.schedule('0 2 * * 1', () => {
      console.log('🧹 Cleaning up old order pipelines...');
      OrderProcessingService.cleanupOldPipelines(7);
    });

    // ✅ Send daily admin summary at 8 AM
    cron.schedule('0 8 * * *', async () => {
      console.log('📊 Generating daily admin summary...');
      // TODO: Implement daily summary email
    });

    console.log('✅ Scheduled services started successfully');
  }
}

export default new ScheduleService();
