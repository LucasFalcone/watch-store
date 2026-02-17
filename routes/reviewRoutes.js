const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { createReview } = require("../controllers/reviewController");

// POST /api/reviews/:productId
router.post("/:productId", authMiddleware, createReview);

module.exports = router;
