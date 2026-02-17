const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");

exports.createReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const productId = req.params.productId;

    // ✅ Verificar que compró el producto y está pagado
    const hasPurchased = await Order.findOne({
      user: req.user.id,
      "items.product": productId,
      status: "paid"
    });

    if (!hasPurchased) {
      return res.status(400).json({
        message: "Debes comprar el producto para poder reseñarlo"
      });
    }

    // ✅ Evitar reseña duplicada
    const alreadyReviewed = await Review.findOne({
      user: req.user.id,
      product: productId
    });

    if (alreadyReviewed) {
      return res.status(400).json({
        message: "Ya reseñaste este producto"
      });
    }

    const review = new Review({
      user: req.user.id,
      product: productId,
      rating,
      comment
    });

    await review.save();

    // 🔥 Actualizar promedio del producto
    const reviews = await Review.find({ product: productId });

    const avgRating =
      reviews.reduce((acc, item) => acc + item.rating, 0) /
      reviews.length;

    await Product.findByIdAndUpdate(productId, {
      averageRating: avgRating,
      reviewCount: reviews.length
    });

    res.status(201).json(review);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
