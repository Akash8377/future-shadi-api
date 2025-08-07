const express = require('express');
const router = express.Router();
const matchesController = require('../controllers/matchesController')


router.get("/my-matches", matchesController.myMatches);
router.get("/new-matches", matchesController.newMatches);
router.get("/new-matches-near-me", matchesController.newMatchesNearMe);
router.get("/shortlisted", matchesController.getShortlisted)

module.exports = router;