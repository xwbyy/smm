const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const qr = require('qr-image');

const app = express();
const port = process.env.PORT || 3000;

// Middleware untuk parsing body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html']
}));

// API Key untuk Indo SMM
const INDO_SMM_API_KEY = '4e59a83d29629d875f9eaa48134d630d';
const INDO_SMM_API_URL = 'https://indosmm.id/api/v2';

// API Key untuk Payment Gateway
const PAYMENT_API_KEY = 'Fupei-pedia-l3p5q04yqvppzw22';
const PAYMENT_API_URL = 'https://fupei-pedia.web.id/api/v1/deposit';

// Simpan order sementara di memory (tanpa database)
let orders = {};
let paymentData = {};

// Endpoint untuk mendapatkan layanan SMM
app.get('/api/services', async (req, res) => {
  try {
    const response = await axios.get(INDO_SMM_API_URL, {
      params: {
        key: INDO_SMM_API_KEY,
        action: 'services'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Endpoint untuk membuat order
app.post('/api/order', async (req, res) => {
  const { service, link, quantity } = req.body;
  
  try {
    // Buat order ke Indo SMM
    const response = await axios.get(INDO_SMM_API_URL, {
      params: {
        key: INDO_SMM_API_KEY,
        action: 'add',
        service,
        link,
        quantity
      }
    });
    
    const orderId = response.data.order;
    orders[orderId] = { service, link, quantity, status: 'pending_payment' };
    
    res.json({ 
      success: true, 
      orderId,
      message: 'Order created successfully. Please proceed to payment.' 
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Endpoint untuk membuat pembayaran QRIS
app.post('/api/create-payment', async (req, res) => {
  const { orderId, amount } = req.body;
  
  try {
    // Buat transaksi pembayaran
    const response = await axios.get(`${PAYMENT_API_URL}/create`, {
      params: {
        nominal: amount,
        apikey: PAYMENT_API_KEY
      },
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!response.data.success) {
      return res.status(400).json({ error: response.data.message || 'Failed to create payment' });
    }

    const payment = response.data.data;
    paymentData[payment.reff_id] = {
      orderId,
      paymentId: payment.id,
      amount: payment.nominal,
      qrString: payment.qr_string,
      expiredAt: payment.expired_at,
      status: 'pending'
    };

    // Generate QR code
    const qrCode = qr.image(payment.qr_string, { type: 'png' });
    let qrBuffer = [];
    qrCode.on('data', chunk => qrBuffer.push(chunk));
    qrCode.on('end', () => {
      const qrImage = Buffer.concat(qrBuffer).toString('base64');
      
      res.json({
        success: true,
        paymentId: payment.reff_id,
        qrImage: `data:image/png;base64,${qrImage}`,
        qrString: payment.qr_string,
        amount: payment.nominal,
        fee: payment.fee,
        getBalance: payment.get_balance,
        expiredAt: payment.expired_at
      });
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Endpoint untuk memeriksa status pembayaran
app.get('/api/check-payment/:paymentId', async (req, res) => {
  const { paymentId } = req.params;
  
  if (!paymentData[paymentId]) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  try {
    const payment = paymentData[paymentId];
    const response = await axios.get(`${PAYMENT_API_URL}/status`, {
      params: {
        trxid: payment.paymentId,
        apikey: PAYMENT_API_KEY
      },
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (response.data.success && response.data.data.status === 'success') {
      // Update status pembayaran
      paymentData[paymentId].status = 'paid';
      
      // Update status order
      if (orders[payment.orderId]) {
        orders[payment.orderId].status = 'processing';
      }
      
      return res.json({ 
        success: true, 
        status: 'paid',
        orderId: payment.orderId
      });
    }

    res.json({ 
      success: true, 
      status: paymentData[paymentId].status 
    });
  } catch (error) {
    console.error('Error checking payment:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// Middleware untuk menangani permintaan tanpa ekstensi .html
app.use((req, res, next) => {
  if (path.extname(req.path) === '') {
    const htmlPath = path.join(__dirname, 'public', req.path + '.html');
    
    fs.access(htmlPath, fs.constants.F_OK, (err) => {
      if (!err) {
        res.sendFile(htmlPath);
      } else {
        next();
      }
    });
  } else {
    next();
  }
});

// Handle all other routes by serving the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});