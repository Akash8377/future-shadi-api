const express = require('express');
const router = express.Router();
const geneticMarkersController = require('../controllers/geneticMarkersController');
const authMiddleware = require('../middlewares/authMiddleware');

// Add this new route
router.post("/save-genetic-markers", authMiddleware, geneticMarkersController.saveGeneticMarkers);
router.get("/get-genetic-markers", authMiddleware, geneticMarkersController.getGeneticMarkers);
router.get("/genetic-markers/:user_id", authMiddleware, geneticMarkersController.getGeneticMarkersByUserId);
router.get("/get-matches-by-genetic-markers", geneticMarkersController.getNewMatchesWithGeneticMarkers);

module.exports = router;