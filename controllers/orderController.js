const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

exports.createOrder = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user.id })
            .populate("items.product");

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: "El carrito está vacío" });
        }

        let totalAmount = 0;

        const orderItems = [];
        for (const item of cart.items) {
            const product = await Product.findById(item.product._id);
            if (!product) {
                return res.status(404).json({ message: "Producto no encontrado" });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({
                    message: `Stock insuficiente para ${product.name}`
                });
            }

            // 🔥 Descontar stock
            product.stock -= item.quantity;
            await product.save();

            totalAmount += product.price * item.quantity;

            orderItems.push({
                product: product._id,
                quantity: item.quantity,
                price: product.price
            });
        }


        const newOrder = new Order({
            user: req.user.id,
            items: orderItems,
            totalAmount
        });

        const savedOrder = await newOrder.save();

        // 🔥 Vaciar carrito después de comprar
        cart.items = [];
        await cart.save();

        res.status(201).json(savedOrder);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 📌 Obtener órdenes del usuario logueado
exports.getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id })
            .populate("items.product");

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 👑 Obtener todas las órdenes (solo admin)
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate("user", "name email")
            .populate("items.product");

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 🔄 Cambiar estado de orden (admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatus = ["pending", "paid", "shipped", "cancelled"];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ message: "Estado inválido" });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Orden no encontrada" });
    }

    // 🔥 Si se cancela y no estaba cancelada antes
    if (status === "cancelled" && order.status !== "cancelled") {

      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }
    }

    order.status = status;
    await order.save();

    res.json(order);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// 💳 Simular pago
exports.payOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Orden no encontrada" });
    }

    order.status = "paid";
    await order.save();

    res.json({ message: "Pago simulado correctamente", order });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


