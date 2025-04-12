import type { NextApiRequest, NextApiResponse } from 'next';
import { saveRatingToFile, saveRatingsToFile } from '../../src/utils/ratingsExport';

type RatingEntry = {
  category: string;
  clue: string;
  answer: string;
  rating: 'good' | 'bad';
  timestamp: string;
};

type ApiResponse = {
  success: boolean;
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    console.log('Received ratings request:', req.body);
    
    // Handle single rating
    if (req.body.type === 'single' && req.body.rating) {
      const rating: RatingEntry = req.body.rating;
      console.log('Processing single rating:', rating);
      await saveRatingToFile(rating);
      return res.status(200).json({ 
        success: true, 
        message: 'Rating saved successfully' 
      });
    }
    
    // Handle batch ratings
    if (req.body.type === 'batch' && Array.isArray(req.body.ratings)) {
      const ratings: RatingEntry[] = req.body.ratings;
      console.log(`Processing batch of ${ratings.length} ratings`);
      await saveRatingsToFile(ratings);
      return res.status(200).json({ 
        success: true, 
        message: `${ratings.length} ratings saved successfully` 
      });
    }

    // Support direct ratings array without type specification
    if (Array.isArray(req.body)) {
      const ratings: RatingEntry[] = req.body;
      console.log(`Processing direct array of ${ratings.length} ratings`);
      await saveRatingsToFile(ratings);
      return res.status(200).json({ 
        success: true, 
        message: `${ratings.length} ratings saved successfully` 
      });
    }

    console.error('Invalid request format:', req.body);
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid request format' 
    });
  } catch (error) {
    console.error('Error handling rating submission:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to save rating' 
    });
  }
}