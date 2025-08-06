const pool = require('../config/db');
const bcrypt = require("bcryptjs");
const User = require('./userModel');

class Gallery{
static async updateGalleryImages(userId, newFilenames) {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
 
    const existingImages = JSON.parse(user.profile_gallery_images || '[]');
 
    // Assign unique IDs to new images
    const newImagesWithId = newFilenames.map(filename => ({
      id: Date.now().toString() + Math.floor(Math.random() * 10000),
      filename,
    }));
 
    // Combine old + new
    const combinedImages = [...existingImages, ...newImagesWithId];
 
    // Limit to 20 images - keep latest 20
    const limitedImages = combinedImages.slice(-20);
 
    const [result] = await pool.query(
      'UPDATE profiles SET profile_gallery_images = ? WHERE user_id = ?',
      [JSON.stringify(limitedImages), userId]
    );
 
    return { success: result.affectedRows > 0, updatedImages: limitedImages };
  } catch (error) {
    console.error('Error updating gallery images', error);
    throw error;
  }
}

static async getGalleryImages(userId){
  try {
      const [rows] = await pool.query('SELECT profile_gallery_images FROM profiles WHERE user_id = ?', [userId]);
      if (rows.length === 0) return [];
 
      const galleryImages = JSON.parse(rows[0].profile_gallery_images || '[]');
      return galleryImages;
    } catch (error) {
      console.error('Error getting gallery images:', error);
      throw error;
    }
}

static async deleteGalleryImage(userId, imageId) {
  try {
    const [rows] = await pool.query(
      'SELECT profile_gallery_images FROM profiles WHERE user_id = ?',
      [userId]
    );
 
    if (rows.length === 0) throw new Error('User not found');
 
    let galleryImages = JSON.parse(rows[0].profile_gallery_images || '[]');
 
    const imageToDelete = galleryImages.find(img => img.id === imageId);
    if (!imageToDelete) throw new Error('Image not found');
 
    // Remove the image from the array
    galleryImages = galleryImages.filter(img => img.id !== imageId);
 
    // Update database
    const [result] = await pool.query(
      'UPDATE profiles SET profile_gallery_images = ? WHERE user_id = ?',
      [JSON.stringify(galleryImages), userId]
    );
 
    return {
      success: result.affectedRows > 0,
      deletedFilename: imageToDelete.filename,
    };
  } catch (error) {
    console.error('Error deleting gallery image:', error);
    throw error;
  }
}
 
}

module.exports = Gallery;