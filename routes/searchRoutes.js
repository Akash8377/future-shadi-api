const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// Add this new route
router.get("/search-profiles", searchController.searchProfiles);
router.post("/search-profiles-filter", searchController.searchProfilesFilter);

module.exports = router;