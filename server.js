// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Cache for services
let servicesCache = {
  data: null,
  timestamp: 0,
  ttl: 300000 // 5 minutes cache
};

// API Proxy Endpoint with caching
app.post('/api/proxy', async (req, res) => {
  try {
    const { action, ...params } = req.body;
    
    // Check cache for services request
    if (action === 'services' && servicesCache.data && 
        (Date.now() - servicesCache.timestamp) < servicesCache.ttl) {
      return res.json(servicesCache.data);
    }
    
    const apiUrl = 'https://indosmm.id/api/v2';
    
    const response = await axios.post(apiUrl, {
      key: process.env.API_KEY || 'your-api-key',
      action,
      ...params
    }, {
      timeout: 10000 // Timeout 10 detik
    });

    // Cache services data
    if (action === 'services' && response.data) {
      servicesCache = {
        data: response.data,
        timestamp: Date.now(),
        ttl: 300000
      };
    }
    
    res.json(response.data);
  } catch (error) {
    console.error('API Error:', error.message);
    
    let errorMessage = 'Gagal memproses permintaan API';
    if (error.response) {
      errorMessage = error.response.data?.error || errorMessage;
    } else if (error.request) {
      errorMessage = 'Tidak ada respon dari server API';
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage
    });
  }
});

// QRIS Payment Endpoint
app.post('/api/create-payment', async (req, res) => {
  try {
    const { amount, orderId } = req.body;
    const API_KEY = process.env.PAYMENT_API_KEY || 'Fupei-pedia-l3p5q04yqvppzw22';
    const API_URL = 'https://fupei-pedia.web.id/api/v1/deposit';

    // Validasi input
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ 
        success: false,
        error: 'Jumlah pembayaran tidak valid'
      });
    }

    if (!orderId) {
      return res.status(400).json({ 
        success: false,
        error: 'Order ID diperlukan'
      });
    }

    const response = await axios.get(`${API_URL}/create`, {
      params: {
        nominal: amount,
        apikey: API_KEY
      },
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      },
      timeout: 10000 // Timeout 10 detik
    });

    if (!response.data || !response.data.success) {
      const errorMsg = response.data?.message || 'Gagal membuat pembayaran';
      return res.status(400).json({ 
        success: false,
        error: errorMsg
      });
    }

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(response.data.data.qr_string)}`;

    res.json({
      success: true,
      message: 'Pembayaran QRIS berhasil dibuat',
      data: {
        ...response.data.data,
        qrImageUrl,
        orderId
      }
    });
  } catch (error) {
    console.error('Payment Error:', error.message);
    
    let errorMsg = 'Terjadi kesalahan saat memproses pembayaran';
    if (error.response) {
      errorMsg = error.response.data?.message || errorMsg;
    } else if (error.request) {
      errorMsg = 'Tidak ada respon dari server pembayaran';
    }

    res.status(500).json({ 
      success: false,
      error: errorMsg
    });
  }
});

// Verify Payment Endpoint
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { paymentId } = req.body;
    const API_KEY = process.env.PAYMENT_API_KEY || 'Fupei-pedia-l3p5q04yqvppzw22';
    const API_URL = 'https://fupei-pedia.web.id/api/v1/deposit';

    if (!paymentId) {
      return res.status(400).json({ 
        success: false,
        error: 'Payment ID diperlukan'
      });
    }

    const response = await axios.get(`${API_URL}/status`, {
      params: {
        id: paymentId,
        apikey: API_KEY
      },
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      },
      timeout: 10000 // Timeout 10 detik
    });

    if (!response.data || !response.data.success) {
      const errorMsg = response.data?.message || 'Gagal memverifikasi pembayaran';
      return res.status(400).json({ 
        success: false,
        error: errorMsg
      });
    }

    res.json({
      success: true,
      message: 'Status pembayaran berhasil diperiksa',
      data: response.data.data
    });
  } catch (error) {
    console.error('Payment Verification Error:', error.message);
    
    let errorMsg = 'Terjadi kesalahan saat memverifikasi pembayaran';
    if (error.response) {
      errorMsg = error.response.data?.message || errorMsg;
    } else if (error.request) {
      errorMsg = 'Tidak ada respon dari server pembayaran';
    }

    res.status(500).json({ 
      success: false,
      error: errorMsg
    });
  }
});

// Handle all other routes - serve static files
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server berjalan di port ${port}`);
});