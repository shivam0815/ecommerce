import express, { Request, Response } from 'express';
import Product from '../models/Product';

const router = express.Router();

// GET /api/search - Search products
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, category, minPrice, maxPrice, sort, page = 1, limit = 20 } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Build search query
    let searchQuery: any = {
      isActive: true,
      inStock: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } },
        { category: { $regex: q, $options: 'i' } }
      ]
    };

    // Add filters
    if (category) {
      searchQuery.category = { $regex: category, $options: 'i' };
    }

    if (minPrice || maxPrice) {
      searchQuery.price = {};
      if (minPrice) searchQuery.price.$gte = Number(minPrice);
      if (maxPrice) searchQuery.price.$lte = Number(maxPrice);
    }

    // Sort options
    let sortQuery: any = { createdAt: -1 }; // Default: newest first
    
    switch (sort) {
      case 'price-low':
        sortQuery = { price: 1 };
        break;
      case 'price-high':
        sortQuery = { price: -1 };
        break;
      case 'rating':
        sortQuery = { rating: -1 };
        break;
      case 'popular':
        sortQuery = { reviews: -1 };
        break;
      case 'name':
        sortQuery = { name: 1 };
        break;
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Execute search
    const [products, totalProducts] = await Promise.all([
      Product.find(searchQuery)
        .sort(sortQuery)
        .skip(skip)
        .limit(limitNum)
        .select('name description price originalPrice images category rating reviews inStock stockQuantity features tags')
        .lean(),
      Product.countDocuments(searchQuery)
    ]);

    // Format results for dropdown (simplified)
    const results = products.map(product => ({
      id: product._id.toString(),
      name: product.name,
      price: product.price,
      image: product.images?.[0] || '/placeholder-product.jpg',
      category: product.category
    }));

    const totalPages = Math.ceil(totalProducts / limitNum);

    res.json({
      success: true,
      results,
      products, // Full product data for search page
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalProducts,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      },
      query: q,
      filters: {
        category,
        minPrice,
        maxPrice,
        sort
      }
    });

  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

// GET /api/search/suggestions - Get search suggestions
router.get('/search/suggestions', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    // Get product name suggestions
    const suggestions = await Product.aggregate([
      {
        $match: {
          isActive: true,
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { tags: { $in: [new RegExp(q, 'i')] } }
          ]
        }
      },
      {
        $project: {
          name: 1,
          category: 1
        }
      },
      {
        $limit: 8
      }
    ]);

    // Get category suggestions
    const categoryMatches = await Product.distinct('category', {
      category: { $regex: q, $options: 'i' },
      isActive: true
    });

    const formattedSuggestions = [
      ...suggestions.map(s => ({
        type: 'product',
        text: s.name,
        category: s.category
      })),
      ...categoryMatches.slice(0, 3).map(cat => ({
        type: 'category',
        text: cat
      }))
    ];

    res.json({
      success: true,
      suggestions: formattedSuggestions.slice(0, 10)
    });

  } catch (error: any) {
    console.error('Suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suggestions'
    });
  }
});

export default router;
