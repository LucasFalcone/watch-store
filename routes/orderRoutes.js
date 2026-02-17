const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  payOrder
} = require("../controllers/orderController");

const Order = require("../models/Order");
const Product = require("../models/Product");

const { Preference } = require("mercadopago");
const client = require("../config/mercadoPago");
const { Payment } = require("mercadopago");


/* =========================
   📦 CREAR ORDEN
========================= */

router.post("/", authMiddleware, createOrder);

/* =========================
   📦 MIS ORDENES
========================= */

router.get("/my", authMiddleware, getMyOrders);

/* =========================
   📦 TODAS (ADMIN)
========================= */

router.get("/", authMiddleware, adminMiddleware, getAllOrders);

/* =========================
   🔄 ACTUALIZAR STATUS
========================= */

router.put("/:id/status", authMiddleware, adminMiddleware, updateOrderStatus);

/* =========================
   💳 MARCAR COMO PAGADA
========================= */

router.put("/:id/pay", authMiddleware, payOrder);

/* =========================
   ❌ CANCELAR ORDEN
   + DEVOLVER STOCK
========================= */

router.put("/:id/cancel", authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Orden no encontrada" });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ message: "La orden ya está cancelada" });
    }

    // Devolver stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } }
      );
    }

    order.status = "cancelled";
    await order.save();

    res.json({ message: "Orden cancelada y stock devuelto" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* =========================
   💳 CREAR PREFERENCIA MP
========================= */

router.post("/create-payment/:orderId", authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("items.product");

    if (!order) {
      return res.status(404).json({ message: "Orden no encontrada" });
    }

    const preference = new Preference(client);

    const response = await preference.create({
      body: {
        items: order.items.map(item => ({
          title: item.product.name,
          unit_price: item.price,
          quantity: item.quantity,
          currency_id: "ARS"
        })),
        back_urls: {
          success: "http://localhost:3000/success",
          failure: "http://localhost:3000/failure",
          pending: "http://localhost:3000/pending"
        },
        auto_return: "approved",

        // 🔔 IMPORTANTE PARA WEBHOOK
        notification_url: "https://tu-backend.com/api/orders/webhook"
      }
    });

    // 🔥 GUARDAMOS EL ID DEL PAGO EN LA ORDEN
    order.paymentId = response.id;
    await order.save();

    res.json({
      init_point: response.init_point
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});


/* =========================
   🔔 WEBHOOK MP
========================= */

router.post("/webhook", async (req, res) => {
  try {
    const payment = req.body;

    if (payment.type === "payment") {
      const paymentClient = new Payment(client);
      const paymentData = await paymentClient.get({
        id: payment.data.id
      });

      if (paymentData.status === "approved") {

        const order = await Order.findOne({
          paymentId: paymentData.id
        });

        if (order) {
          order.isPaid = true;
          order.status = "paid";
          order.paidAt = new Date();
          await order.save();
        }
      }
    }

    res.sendStatus(200);

  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

router.get("/admin/stats", authMiddleware, adminMiddleware, async (req, res) => {
  try {

    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } }
    ]);

    const paidOrders = await Order.countDocuments({ isPaid: true });
    const pendingOrders = await Order.countDocuments({ isPaid: false });

    res.json({
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      paidOrders,
      pendingOrders
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



module.exports = router;