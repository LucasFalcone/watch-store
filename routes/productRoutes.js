const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const Review = require("../models/Review");
const Order = require("../models/Order");

/* ==============================
   📦 CONFIGURACIÓN CLOUDINARY
================================= */

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "ecommerce-products",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

const upload = multer({ storage });

/* ==============================
   🟢 GET PRODUCTOS
   Con paginación + filtros
================================= */

router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      minPrice,
      maxPrice,
      brand,
    } = req.query;

    const query = {};

    // Filtro por precio
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Filtro por marca
    if (brand) {
      query.brand = brand;
    }

    const products = await Product.find(query)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Product.countDocuments(query);

    res.json({
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      products,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener productos" });
  }
});

/* ==============================
   🔍 GET PRODUCTO POR ID
================================= */

router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ==============================
   ➕ POST CREAR PRODUCTO
   Con imagen subida a Cloudinary
================================= */

router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const newProduct = new Product({
        ...req.body,
        image: req.file ? req.file.path : null,
      });

      const savedProduct = await newProduct.save();
      res.status(201).json(savedProduct);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  }
);

/* ==============================
   ✏️ PUT ACTUALIZAR PRODUCTO
================================= */

router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const updateData = { ...req.body };

      if (req.file) {
        updateData.image = req.file.path;
      }

      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );

      if (!updatedProduct) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }

      res.json(updatedProduct);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

/* ==============================
   ❌ DELETE PRODUCTO
================================= */

router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const deletedProduct = await Product.findByIdAndDelete(req.params.id);

      if (!deletedProduct) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }

      res.json({ message: "Producto eliminado correctamente" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// GET /api/products/:id/details
router.get("/:id/details", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const reviewsRaw = await Review.find({
      product: req.params.id
    })
      .populate("user", "name")
      .sort({ createdAt: -1 });

    const reviews = await Promise.all(
      reviewsRaw.map(async (review) => {

        const verifiedPurchase = await Order.findOne({
          user: review.user._id,
          "items.product": req.params.id,
          status: "paid"
        });

        return {
          ...review.toObject(),
          verifiedPurchase: !!verifiedPurchase
        };
      })
    );

    res.json({
      product,
      reviews
    });


  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/products/top-rated
router.get("/top-rated", async (req, res) => {
  try {

    const products = await Product.find({
      reviewCount: { $gt: 0 }
    })
      .sort({ averageRating: -1, reviewCount: -1 })
      .limit(5);

    res.json(products);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



module.exports = router;
