import { Request, Response, NextFunction } from 'express';
import validator from 'validator';

export const validateEmail = (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;
  
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ message: 'Valid email is required' });
  }
  
  next();
};

export const validatePassword = (req: Request, res: Response, next: NextFunction) => {
  const { password } = req.body;
  
  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }
  
  next();
};

export const validatePhone = (req: Request, res: Response, next: NextFunction) => {
  const { phone } = req.body;
  
  if (phone && !validator.isMobilePhone(phone, 'en-IN')) {
    return res.status(400).json({ message: 'Valid phone number is required' });
  }
  
  next();
};

export const validateProduct = (req: Request, res: Response, next: NextFunction) => {
  const { name, description, price, category } = req.body;
  
  if (!name || !description || !price || !category) {
    return res.status(400).json({ 
      message: 'Name, description, price, and category are required' 
    });
  }
  
  if (price < 0) {
    return res.status(400).json({ message: 'Price cannot be negative' });
  }
  
  next();
};