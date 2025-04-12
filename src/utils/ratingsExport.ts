import fs from 'fs';
import path from 'path';

interface RatingEntry {
  category: string;
  clue: string;
  answer: string;
  rating: 'good' | 'bad';
  timestamp: string;
}

/**
 * Saves a rating entry to the JSON export file
 */
export const saveRatingToFile = async (rating: RatingEntry): Promise<void> => {
  try {
    const exportFilePath = path.join(process.cwd(), 'json', 'ratings-export.json');
    
    // Ensure the json directory exists
    const jsonDir = path.join(process.cwd(), 'json');
    if (!fs.existsSync(jsonDir)) {
      console.log('Creating json directory');
      fs.mkdirSync(jsonDir, { recursive: true });
    }
    
    // Read existing ratings file
    let ratings: RatingEntry[] = [];
    try {
      if (fs.existsSync(exportFilePath)) {
        const fileData = fs.readFileSync(exportFilePath, 'utf8');
        ratings = JSON.parse(fileData);
      }
    } catch (error) {
      console.error('Error reading ratings file:', error);
    }
    
    // Add new rating
    ratings.push(rating);
    
    // Write updated ratings back to file
    fs.writeFileSync(exportFilePath, JSON.stringify(ratings, null, 2), 'utf8');
    
    console.log('Rating saved to file:', rating);
  } catch (error) {
    console.error('Error saving rating to file:', error);
    throw error;
  }
};

/**
 * Saves multiple rating entries to the JSON export file
 */
export const saveRatingsToFile = async (ratings: RatingEntry[]): Promise<void> => {
  try {
    const exportFilePath = path.join(process.cwd(), 'json', 'ratings-export.json');
    
    // Ensure the json directory exists
    const jsonDir = path.join(process.cwd(), 'json');
    if (!fs.existsSync(jsonDir)) {
      console.log('Creating json directory');
      fs.mkdirSync(jsonDir, { recursive: true });
    }
    
    // Read existing ratings file
    let existingRatings: RatingEntry[] = [];
    try {
      if (fs.existsSync(exportFilePath)) {
        const fileData = fs.readFileSync(exportFilePath, 'utf8');
        existingRatings = JSON.parse(fileData);
      }
    } catch (error) {
      console.error('Error reading ratings file:', error);
    }
    
    // Add new ratings
    const updatedRatings = [...existingRatings, ...ratings];
    
    // Write updated ratings back to file
    fs.writeFileSync(exportFilePath, JSON.stringify(updatedRatings, null, 2), 'utf8');
    
    console.log(`${ratings.length} ratings saved to file`);
  } catch (error) {
    console.error('Error saving ratings to file:', error);
    throw error;
  }
};