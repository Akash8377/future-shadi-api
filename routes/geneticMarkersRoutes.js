const express = require('express');
const router = express.Router();
const geneticMarkersController = require('../controllers/geneticMarkersController');
const authMiddleware = require('../middlewares/authMiddleware');


router.post("/save-genetic-markers", authMiddleware, geneticMarkersController.saveGeneticMarkers);
router.get("/get-genetic-markers", authMiddleware, geneticMarkersController.getGeneticMarkers);
router.get("/genetic-markers/:user_id", authMiddleware, geneticMarkersController.getGeneticMarkersByUserId);
router.get("/get-matches-by-genetic-markers", geneticMarkersController.getNewMatchesWithGeneticMarkers);
// HLA Routes
router.get('/get-hla-data', authMiddleware, geneticMarkersController.getHLAData);
router.post('/save-hla-data', authMiddleware, geneticMarkersController.saveHLAData);
router.get('/hla-compatibility/:partner_id', authMiddleware, geneticMarkersController.getHLACompatibility);

module.exports = router;