// src/controllers/userController.ts - CONVERTED TO TYPESCRIPT
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import Order from '../models/Order';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

// ✅ Get User Statistics
export const getUserStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    console.log('📊 Fetching user stats for userId:', userId);

    // Convert to ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get basic order counts
    const totalOrders = await Order.countDocuments({ userId: userObjectId });
    console.log('📈 Total orders:', totalOrders);
    
    const completedOrders = await Order.countDocuments({ 
      userId: userObjectId, 
      status: { $in: ['delivered', 'completed'] } 
    });
    
    const pendingOrders = await Order.countDocuments({ 
      userId: userObjectId, 
      status: { $in: ['pending', 'confirmed', 'processing', 'shipped'] } 
    });

    // Calculate total spent using aggregation
    const spentResult = await Order.aggregate([
      { $match: { userId: userObjectId, paymentStatus: { $in: ['paid', 'cod_paid'] } } },
      { $group: { _id: null, totalSpent: { $sum: '$total' } } }
    ]);

    const totalSpent = spentResult.length > 0 ? spentResult[0].totalSpent : 0;

    const stats = {
      totalOrders,
      totalSpent: parseFloat(totalSpent.toFixed(2)),
      pendingOrders,
      completedOrders
    };

    console.log('✅ User stats calculated successfully:', stats);
    res.json(stats);
    
  } catch (error: any) {
    console.error('❌ Error in getUserStats:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ Get User Orders
export const getUserOrders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    console.log('📦 Fetching orders for user:', userId);

    // Convert to ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const orders = await Order.find({ userId: userObjectId })
      .populate('items.productId', 'name images price')
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ Found ${orders.length} orders for user`);

    res.json({
      success: true,
      orders: orders || []
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ✅ Update User Profile
export const updateUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const updates = req.body;
    console.log('📝 Updating user profile:', userId);

    // Remove sensitive fields
    delete updates.password;
    delete updates.role;
    delete updates._id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
    
  } catch (error: any) {
    console.error('❌ Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};
