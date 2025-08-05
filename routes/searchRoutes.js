const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const authMiddleware = require('../middlewares/authMiddleware');

// Add this new route
router.get("/search-profiles", authMiddleware, searchController.searchProfiles);
router.post("/search-profiles-filter", searchController.searchProfilesFilter);
// Change from POST to GET since you're using axios.get in the frontend
router.get("/search-by-profileId/:profileId", searchController.searchProfileId);

// In your routes file
router.get("/recent-searches", authMiddleware, searchController.getRecentSearches);
router.delete("/recent-searches/:id", authMiddleware, searchController.deleteRecentSearch);

module.exports = router;