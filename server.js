require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const qr = require('qr-image');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Config
const INDO_SMM_API = {
  key: process.env.INDO_SMM_API_KEY || '4e59a83d29629d875f9eaa48134d630d',
  url: 'https://indosmm.id/api/v2'
};

const PAYMENT_API = {
  key: process.env.HIAY_API_KEY || 'Fupei-pedia-l3p5q04yqvppzw22',
  url: 'https://fupei-pedia.web.id/api/v1/deposit'
};

const PRICE_MARKUP = process.env.PRICE_MARKUP || 20; // 20% markup

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html']
}));

// Data storage
const data = {
  services: [],
  orders: {},
  payments: {},
  lastServiceUpdate: null
};

// Helper functions
const calculatePrice = (rate, quantity) => {
  const markedUpRate = rate * (1 + PRICE_MARKUP / 100);
  return (markedUpRate * quantity).toFixed(2);
};

// API Endpoints

// Get all services
app.get('/api/services', async (req, res) => {
  try {
    // Cache services for 5 minutes
    if (data.services.length > 0 && Date.now() - data.lastServiceUpdate < 300000) {
      return res.json(data.services);
    }

    const response = await axios.get(INDO_SMM_API.url, {
      params: { key: INDO_SMM_API.key, action: 'services' }
    });

    data.services = response.data.map(service => ({
      ...service,
      originalRate: parseFloat(service.rate),
      rate: parseFloat(service.rate) * (1 + PRICE_MARKUP / 100)
    }));
    data.lastServiceUpdate = Date.now();

    res.json(data.services);
  } catch (error) {
    console.error('Services error:', error.message);
    res.status(500).json({ error: 'Failed to load services' });
  }
});

// Get service categories
app.get('/api/categories', (req, res) => {
  const categories = [...new Set(data.services.map(s => s.category))];
  res.json(categories);
});

// Create new order
app.post('/api/orders', async (req, res) => {
  const { serviceId, link, quantity } = req.body;

  try {
    const service = data.services.find(s => s.service == serviceId);
    if (!service) return res.status(400).json({ error: 'Service not found' });

    // Validate quantity
    const qty = parseInt(quantity);
    if (qty < service.min || qty > service.max) {
      return res.status(400).json({ 
        error: `Quantity must be between ${service.min} and ${service.max}`
      });
    }

    // Create order with Indo SMM
    const orderRes = await axios.get(INDO_SMM_API.url, {
      params: {
        key: INDO_SMM_API.key,
        action: 'add',
        service: serviceId,
        link,
        quantity: qty
      }
    });

    const orderId = orderRes.data.order;
    const totalPrice = calculatePrice(service.originalRate, qty);

    data.orders[orderId] = {
      id: orderId,
      serviceId,
      serviceName: service.name,
      link,
      quantity: qty,
      price: totalPrice,
      status: 'pending_payment',
      createdAt: new Date(),
      completed: 0
    };

    res.json({ 
      success: true,
      orderId,
      amount: totalPrice,
      serviceName: service.name
    });

  } catch (error) {
    console.error('Order error:', error.message);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Create payment
app.post('/api/payments', async (req, res) => {
  const { orderId, amount } = req.body;

  try {
    if (!data.orders[orderId]) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const paymentRes = await axios.get(`${PAYMENT_API.url}/create`, {
      params: {
        nominal: amount * 1000, // Convert to Rupiah
        apikey: PAYMENT_API.key
      },
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!paymentRes.data.success) {
      return res.status(400).json({ error: paymentRes.data.message });
    }

    const payment = paymentRes.data.data;
    const qrImage = qr.imageSync(payment.qr_string, { type: 'png' });

    data.payments[payment.reff_id] = {
      id: payment.reff_id,
      orderId,
      paymentId: payment.id,
      amount: payment.nominal,
      qrString: payment.qr_string,
      expiredAt: payment.expired_at,
      status: 'pending'
    };

    res.json({
      success: true,
      paymentId: payment.reff_id,
      qrImage: `data:image/png;base64,${qrImage.toString('base64')}`,
      qrString: payment.qr_string,
      amount: payment.nominal,
      fee: payment.fee,
      expiredAt: payment.expired_at
    });

  } catch (error) {
    console.error('Payment error:', error.message);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Check payment status
app.get('/api/payments/:paymentId/status', async (req, res) => {
  const { paymentId } = req.params;

  try {
    const payment = data.payments[paymentId];
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (payment.status === 'paid') {
      return res.json({ 
        success: true, 
        status: 'paid',
        orderId: payment.orderId
      });
    }

    const statusRes = await axios.get(`${PAYMENT_API.url}/status`, {
      params: {
        trxid: payment.paymentId,
        apikey: PAYMENT_API.key
      },
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (statusRes.data.success && statusRes.data.data.status === 'success') {
      payment.status = 'paid';
      data.orders[payment.orderId].status = 'processing';
      
      return res.json({ 
        success: true, 
        status: 'paid',
        orderId: payment.orderId
      });
    }

    res.json({ 
      success: true, 
      status: payment.status 
    });

  } catch (error) {
    console.error('Payment status error:', error.message);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// Check order status
app.get('/api/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = data.orders[orderId];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const statusRes = await axios.get(INDO_SMM_API.url, {
      params: {
        key: INDO_SMM_API.key,
        action: 'status',
        order: orderId
      }
    });

    if (statusRes.data.error) {
      return res.status(400).json({ error: statusRes.data.error });
    }

    // Update order status
    order.status = statusRes.data.status.toLowerCase();
    order.completed = parseInt(statusRes.data.start_count) || 0;
    order.remains = parseInt(statusRes.data.remains) || 0;

    res.json({
      success: true,
      status: order.status,
      completed: order.completed,
      remains: order.remains
    });

  } catch (error) {
    console.error('Order status error:', error.message);
    res.status(500).json({ error: 'Failed to check order status' });
  }
});

// HTML Routes
app.use((req, res, next) => {
  if (path.extname(req.path) === '') {
    const htmlPath = path.join(__dirname, 'public', req.path + '.html');
    fs.access(htmlPath, fs.constants.F_OK, (err) => {
      if (!err) res.sendFile(htmlPath);
      else next();
    });
  } else {
    next();
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});