const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Middleware untuk parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html']
}));

// API untuk memproses order SMM
app.post('/api/order', async (req, res) => {
  try {
    const { service, link, quantity } = req.body;
    
    // Simpan order dalam memory (tanpa database)
    const orderId = Math.floor(10000 + Math.random() * 90000);
    const order = {
      id: orderId,
      service,
      link,
      quantity,
      status: 'pending_payment',
      createdAt: new Date()
    };
    
    // Simpan order dalam memory
    if (!app.locals.orders) {
      app.locals.orders = [];
    }
    app.locals.orders.push(order);
    
    res.json({
      success: true,
      orderId,
      message: 'Order berhasil dibuat, silakan lakukan pembayaran'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat memproses order' });
  }
});

// API untuk membuat pembayaran QRIS
app.post('/api/create-payment', async (req, res) => {
  try {
    const { amount, orderId } = req.body;
    
    // Gunakan API Hiay Payment Gateway
    const API_KEY = 'Fupei-pedia-l3p5q04yqvppzw22';
    const API_URL = 'https://fupei-pedia.web.id/api/v1/deposit';
    
    const response = await axios.get(`${API_URL}/create`, {
      params: {
        nominal: amount,
        apikey: API_KEY
      },
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    if (!response.data.success) {
      return res.status(400).json({
        success: false,
        message: response.data.message || 'Gagal membuat transaksi pembayaran'
      });
    }
    
    const paymentData = response.data.data;
    
    // Simpan data pembayaran dalam memory
    if (!app.locals.payments) {
      app.locals.payments = {};
    }
    app.locals.payments[orderId] = {
      paymentId: paymentData.id,
      reffId: paymentData.reff_id,
      amount: paymentData.nominal,
      qrString: paymentData.qr_string,
      expiredAt: paymentData.expired_at,
      status: 'pending'
    };
    
    res.json({
      success: true,
      qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(paymentData.qr_string)}`,
      paymentData: {
        reffId: paymentData.reff_id,
        amount: paymentData.nominal,
        expiredAt: paymentData.expired_at
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat membuat pembayaran' });
  }
});

// API untuk mengecek status pembayaran
app.get('/api/check-payment/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const payment = app.locals.payments?.[orderId];
    
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Data pembayaran tidak ditemukan' });
    }
    
    // Cek status pembayaran di Hiay Payment Gateway
    const API_KEY = 'Fupei-pedia-l3p5q04yqvppzw22';
    const API_URL = 'https://fupei-pedia.web.id/api/v1/deposit';
    
    const response = await axios.get(`${API_URL}/status`, {
      params: {
        trxid: payment.paymentId,
        apikey: API_KEY
      },
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    if (response.data.success && response.data.data.status === 'success') {
      // Update status pembayaran
      payment.status = 'paid';
      
      // Update status order
      const order = app.locals.orders.find(o => o.id.toString() === orderId);
      if (order) {
        order.status = 'processing';
        
        // Proses order ke Indo SMM API
        // Ini adalah contoh, Anda perlu menyesuaikan dengan API SMM yang sebenarnya
        const smmResponse = await axios.post('https://indosmm.id/api/v2', {
          key: 'API_KEY_ANDA',
          action: 'add',
          service: order.service,
          link: order.link,
          quantity: order.quantity
        });
        
        if (smmResponse.data.order) {
          order.status = 'completed';
          order.smmOrderId = smmResponse.data.order;
        }
      }
      
      return res.json({
        success: true,
        paid: true,
        message: 'Pembayaran berhasil diverifikasi'
      });
    }
    
    res.json({
      success: true,
      paid: false,
      message: 'Pembayaran belum diterima'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengecek pembayaran' });
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