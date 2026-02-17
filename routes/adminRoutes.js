const express = require("express");
const router = express.Router();

const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

/* =========================
   📊 DASHBOARD STATS
========================= */

router.get("/stats", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalUsers = await User.countDocuments();

    const revenueData = await Order.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    res.json({
      totalProducts,
      totalOrders,
      totalUsers,
      revenue: revenueData[0]?.total || 0
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
