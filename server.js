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
    // Buat order ke SMM API
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
    
    // Hitung total harga berdasarkan rate (contoh sederhana)
    // Di implementasi nyata, Anda perlu mendapatkan rate dari API atau markup
    const rate = 0.90; // Contoh rate per 1000
    const total = (rate * quantity).toFixed(2);
    
    // Buat pembayaran QRIS
    const paymentResponse = await axios.get(`${PAYMENT_API_URL}/create`, {
      params: {
        nominal: Math.ceil(total * 1000), // Konversi ke Rupiah (contoh)
        apikey: PAYMENT_API_KEY
      }
    });
    
    if (!paymentResponse.data.success) {
      return res.status(400).json({ error: 'Gagal membuat pembayaran' });
    }
    
    const paymentData = paymentResponse.data.data;
    
    res.json({
      orderId,
      payment: {
        qrString: paymentData.qr_string,
        qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(paymentData.qr_string)}`,
        amount: paymentData.nominal,
        expiredAt: paymentData.expired_at,
        transactionId: paymentData.reff_id
      }
    });
    
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Gagal membuat order' });
  }
});

// Endpoint untuk memeriksa status pembayaran
app.get('/api/payment/status/:trxid', async (req, res) => {
  try {
    const response = await axios.get(`${PAYMENT_API_URL}/status`, {
      params: {
        trxid: req.params.trxid,
        apikey: PAYMENT_API_KEY
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ error: 'Gagal memeriksa status pembayaran' });
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