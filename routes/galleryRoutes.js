const express = require('express');
const router = express.Router();
const galleryController = require('../controllers/galleryController');
const upload = require('../config/multer');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/upload-gallery', authMiddleware, upload.array('gallery', 20), galleryController.uploadGalleryImages)
router.get('/gallery', authMiddleware,galleryController.getGalleryImages);
router.delete('/gallery/image/:imageId', authMiddleware, galleryController.deleteGalleryImage)
module.exports = router;