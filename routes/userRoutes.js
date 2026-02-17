const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

/* =========================
   ❤️ TOGGLE WISHLIST
========================= */

router.put("/wishlist/:productId", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const productId = req.params.productId;

    const exists = user.wishlist.includes(productId);

    if (exists) {
      user.wishlist.pull(productId);
    } else {
      user.wishlist.push(productId);
    }

    await user.save();

    res.json({
      message: exists
        ? "Producto eliminado de wishlist"
        : "Producto agregado a wishlist",
      wishlist: user.wishlist
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* =========================
   📦 GET WISHLIST COMPLETA
========================= */

router.get("/wishlist", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id)
    .populate("wishlist");

  res.json(user.wishlist);
});

module.exports = router;
