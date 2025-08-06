const Gallery = require("../models/gallaryModel");
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

exports.uploadGalleryImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }
 
    const userId = req.user.id;
    const imageFilenames = req.files.map(file => file.filename);
 
    const { success, updatedImages } = await Gallery.updateGalleryImages(userId, imageFilenames);
 
    if (!success) {
      for (const file of req.files) {
        await unlinkAsync(path.join(__dirname, '../public/uploads/profiles', file.filename));
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to update profile gallery images',
      });
    }
 
    res.status(200).json({
      success: true,
      images: updatedImages,
      message: `${imageFilenames.length} image(s) uploaded successfully`,
    });
  } catch (error) {
    console.error('Gallery images upload error:', error);
 
    if (req.files) {
      for (const file of req.files) {
        try {
          await unlinkAsync(path.join(__dirname, '../public/uploads/profiles', file.filename));
        } catch (err) {
          console.error('Error cleaning up files:', err);
        }
      }
    }
 
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during gallery images upload',
    });
  }
};
 
exports.getGalleryImages = async (req, res) => {
  try {
    const userId = req.user.id;
    const images = await Gallery.getGalleryImages(userId);
 
    res.status(200).json({
      success: true,
      images,
    });
  } catch (error) {
    console.error('Error fetching gallery images:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch gallery images',
    });
  }
};
 
exports.deleteGalleryImage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { imageId } = req.params;
 
    const { success, deletedFilename } = await Gallery.deleteGalleryImage(userId, imageId);
 
    if (success && deletedFilename) {
      const imagePath = path.join(__dirname, '../public/uploads/profiles', deletedFilename);
      try {
        await unlinkAsync(imagePath);
      } catch (err) {
        console.warn('File not found or already deleted:', imagePath);
      }
    }
 
    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    console.error('Delete gallery image error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete gallery image',
    });
  }
};