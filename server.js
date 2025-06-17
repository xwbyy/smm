require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const qr = require('qr-image');

const app = express();
const port = process.env.PORT || 3000;

// Konfigurasi
const SMM_API_URL = 'https://indosmm.id/api/v2';
const PAYMENT_API_KEY = 'Fupei-pedia-mw0ghsxujpn9fkg7';
const PAYMENT_API_URL = 'https://fupei-pedia.web.id/api/v1/deposit';
const ADMIN_MARKUP = 1.2; // Markup 20%

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper functions
const calculatePrice = (rate, quantity) => {
  return Math.ceil((rate * quantity / 1000) * ADMIN_MARKUP);
};

const generateQR = (text) => {
  try {
    return qr.imageSync(text, { type: 'png' });
  } catch (err) {
    console.error('QR generation error:', err);
    return null;
  }
};

// API Proxy Endpoints
const verifyApiKey = (req, res, next) => {
  if (!req.body.key && !req.query.key) {
    return res.status(400).json({ error: 'API key is required' });
  }
  next();
};

// Get services
app.post('/api/services', verifyApiKey, async (req, res) => {
  try {
    const response = await axios.post(SMM_API_URL, {
      key: req.body.key,
      action: 'services'
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create payment and order
app.post('/api/create-order', async (req, res) => {
  try {
    const { serviceId, link, quantity, key } = req.body;
    
    if (!serviceId || !link || !quantity || !key) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get service details to calculate price
    const serviceResponse = await axios.post(SMM_API_URL, {
      key: key,
      action: 'services'
    });
    
    const service = serviceResponse.data.find(s => s.service == serviceId);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const price = calculatePrice(parseFloat(service.rate), parseInt(quantity));
    
    // Create payment
    const paymentResponse = await axios.get(`${PAYMENT_API_URL}/create`, {
      params: {
        nominal: price,
        apikey: PAYMENT_API_KEY
      },
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!paymentResponse.data.success) {
      return res.status(400).json({ error: paymentResponse.data.message || 'Payment creation failed' });
    }

    const paymentData = paymentResponse.data.data;
    
    // Return payment info and store order data temporarily
    const orderData = {
      paymentId: paymentData.id,
      reffId: paymentData.reff_id,
      serviceId,
      link,
      quantity,
      key,
      amount: price,
      status: 'pending',
      createdAt: new Date()
    };

    res.json({
      success: true,
      payment: {
        qrString: paymentData.qr_string,
        qrImage: `data:image/png;base64,${generateQR(paymentData.qr_string).toString('base64')}`,
        amount: price,
        expiredAt: paymentData.expired_at,
        reffId: paymentData.reff_id
      },
      order: orderData
    });

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check payment status and process order
app.post('/api/check-payment', async (req, res) => {
  try {
    const { paymentId, orderData } = req.body;
    
    if (!paymentId || !orderData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check payment status
    const statusResponse = await axios.get(`${PAYMENT_API_URL}/status`, {
      params: {
        trxid: paymentId,
        apikey: PAYMENT_API_KEY
      },
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!statusResponse.data.success) {
      return res.json({ 
        status: 'failed', 
        message: statusResponse.data.message || 'Payment check failed' 
      });
    }

    const paymentStatus = statusResponse.data.data.status;
    
    if (paymentStatus === 'success') {
      // Payment successful, create order
      const orderResponse = await axios.post(SMM_API_URL, {
        key: orderData.key,
        action: 'add',
        service: orderData.serviceId,
        link: orderData.link,
        quantity: orderData.quantity
      });

      return res.json({
        status: 'success',
        payment: statusResponse.data.data,
        order: orderResponse.data
      });
    } else if (paymentStatus === 'pending') {
      return res.json({ status: 'pending' });
    } else {
      return res.json({ 
        status: 'failed', 
        message: 'Payment failed or expired' 
      });
    }
  } catch (error) {
    console.error('Payment check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Other SMM API endpoints
app.post('/api/order/status', verifyApiKey, async (req, res) => {
  try {
    const response = await axios.post(SMM_API_URL, {
      key: req.body.key,
      action: 'status',
      order: req.body.order
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/balance', verifyApiKey, async (req, res) => {
  try {
    const response = await axios.post(SMM_API_URL, {
      key: req.body.key,
      action: 'balance'
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/order/refill', verifyApiKey, async (req, res) => {
  try {
    const response = await axios.post(SMM_API_URL, {
      key: req.body.key,
      action: 'refill',
      order: req.body.order
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/order/cancel', verifyApiKey, async (req, res) => {
  try {
    const response = await axios.post(SMM_API_URL, {
      key: req.body.key,
      action: 'cancel',
      orders: req.body.orders
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});