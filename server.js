const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html']
}));

// Konfigurasi API
const SMM_API_URL = 'https://indosmm.id/api/v2';
const SMM_API_KEY = '4e59a83d29629d875f9eaa48134d630d';
const PAYMENT_API_URL = 'https://fupei-pedia.web.id/api/v1/deposit';
const PAYMENT_API_KEY = 'Fupei-pedia-l3p5q04yqvppzw22';

// Cache sederhana untuk order
const orderCache = new Map();

// Endpoint untuk mendapatkan daftar layanan
app.get('/api/services', async (req, res) => {
  try {
    const response = await axios.get(SMM_API_URL, {
      params: {
        key: SMM_API_KEY,
        action: 'services'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Gagal mengambil daftar layanan' });
  }
});

// Endpoint untuk membuat order
app.post('/api/order', async (req, res) => {
  const { service, link, quantity } = req.body;
  
  try {
    // 1. Buat order ke SMM API
    const smmResponse = await axios.get(SMM_API_URL, {
      params: {
        key: SMM_API_KEY,
        action: 'add',
        service,
        link,
        quantity
      }
    });
    
    const orderId = smmResponse.data.order;
    
    // 2. Hitung total harga (contoh: rate per 1000)
    const serviceData = await findServiceById(service);
    const rate = parseFloat(serviceData.rate) || 0.90;
    const total = Math.ceil((rate * quantity) * 1000); // Konversi ke Rupiah
    
    // 3. Buat pembayaran QRIS
    const paymentResponse = await axios.get(`${PAYMENT_API_URL}/create`, {
      params: {
        nominal: total,
        apikey: PAYMENT_API_KEY
      }
    });
    
    if (!paymentResponse.data.success) {
      return res.status(400).json({ 
        error: 'Gagal membuat pembayaran',
        details: paymentResponse.data.message 
      });
    }
    
    const paymentData = paymentResponse.data.data;
    
    // Simpan data order ke cache
    const orderData = {
      orderId,
      service,
      link,
      quantity,
      total,
      payment: {
        id: paymentData.id,
        reffId: paymentData.reff_id,
        qrString: paymentData.qr_string,
        amount: paymentData.nominal,
        fee: paymentData.fee,
        getBalance: paymentData.get_balance,
        expiredAt: paymentData.expired_at,
        status: 'pending'
      },
      createdAt: new Date().toISOString()
    };
    
    orderCache.set(paymentData.reff_id, orderData);
    
    res.json({
      success: true,
      order: orderData
    });
    
  } catch (error) {
    console.error('Error creating order:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Gagal membuat order',
      details: error.response?.data?.message || error.message 
    });
  }
});

// Endpoint untuk memeriksa status pembayaran
app.get('/api/payment/status/:reffId', async (req, res) => {
  try {
    // 1. Cek di cache dulu
    const orderData = orderCache.get(req.params.reffId);
    if (!orderData) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }
    
    // 2. Cek status pembayaran ke API
    const response = await axios.get(`${PAYMENT_API_URL}/status`, {
      params: {
        trxid: orderData.payment.id,
        apikey: PAYMENT_API_KEY
      }
    });
    
    if (response.data.success && response.data.data.status === 'success') {
      // Update status di cache
      orderData.payment.status = 'completed';
      orderCache.set(req.params.reffId, orderData);
    }
    
    res.json({
      status: response.data.data.status,
      order: orderData
    });
    
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ 
      error: 'Gagal memeriksa status pembayaran',
      details: error.response?.data?.message || error.message 
    });
  }
});

// Helper function untuk mencari service by ID
async function findServiceById(serviceId) {
  try {
    const response = await axios.get(SMM_API_URL, {
      params: {
        key: SMM_API_KEY,
        action: 'services'
      }
    });
    return response.data.find(s => s.service == serviceId) || {};
  } catch (error) {
    console.error('Error finding service:', error);
    return {};
  }
}

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

// Handle all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});