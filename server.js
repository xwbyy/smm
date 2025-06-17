const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Konfigurasi API
const INDO_SMM_API = 'https://indosmm.id/api/v2';
const INDO_SMM_KEY = '4e59a83d29629d875f9eaa48134d630d';
const HIAY_API_KEY = 'Fupei-pedia-l3p5q04yqvppzw22';
const HIAY_API_URL = 'https://fupei-pedia.web.id/api/v1/deposit';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Variabel penyimpanan sementara (tanpa database)
const storage = {
  orders: [],
  payments: {},
  services: []
};

// Fungsi untuk mendapatkan layanan dari Indo SMM
async function fetchServices() {
  try {
    const response = await axios.post(INDO_SMM_API, {
      key: INDO_SMM_KEY,
      action: 'services'
    });
    
    if (response.data && Array.isArray(response.data)) {
      storage.services = response.data;
      console.log('Daftar layanan berhasil diperbarui');
    }
  } catch (error) {
    console.error('Gagal memuat layanan:', error.message);
  }
}

// Memuat layanan saat server start
fetchServices();
// Perbarui layanan setiap 1 jam
setInterval(fetchServices, 3600000);

// API Endpoints

// Get services
app.get('/api/services', (req, res) => {
  res.json({ success: true, services: storage.services });
});

// Create order
app.post('/api/order', async (req, res) => {
  try {
    const { service, link, quantity } = req.body;
    
    // Validasi
    if (!service || !link || !quantity) {
      return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }
    
    // Cari layanan
    const selectedService = storage.services.find(s => s.service == service);
    if (!selectedService) {
      return res.status(400).json({ success: false, message: 'Layanan tidak ditemukan' });
    }
    
    // Validasi quantity
    const qty = parseInt(quantity);
    if (qty < selectedService.min || qty > selectedService.max) {
      return res.status(400).json({ 
        success: false, 
        message: `Jumlah harus antara ${selectedService.min} - ${selectedService.max}` 
      });
    }
    
    // Hitung harga (dengan markup 10%)
    const rate = parseFloat(selectedService.rate);
    const price = Math.ceil((rate * qty / 1000) * 1.1; // Markup 10%
    
    // Buat order
    const orderId = Date.now();
    const order = {
      id: orderId,
      serviceId: service,
      serviceName: selectedService.name,
      link,
      quantity: qty,
      price,
      status: 'pending_payment',
      createdAt: new Date()
    };
    
    storage.orders.push(order);
    
    res.json({ 
      success: true, 
      orderId,
      price,
      message: 'Order berhasil dibuat, silakan lakukan pembayaran' 
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// Create payment
app.post('/api/create-payment', async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    
    // Validasi order
    const order = storage.orders.find(o => o.id == orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    }
    
    // Buat pembayaran via Hiay
    const response = await axios.get(`${HIAY_API_URL}/create`, {
      params: {
        nominal: amount,
        apikey: HIAY_API_KEY
      },
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!response.data.success) {
      return res.status(400).json({
        success: false,
        message: response.data.message || 'Gagal membuat pembayaran'
      });
    }
    
    const paymentData = response.data.data;
    
    // Simpan data pembayaran
    storage.payments[orderId] = {
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
    res.status(500).json({ success: false, message: 'Gagal membuat pembayaran' });
  }
});

// Check payment status
app.get('/api/check-payment/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const payment = storage.payments[orderId];
    
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Pembayaran tidak ditemukan' });
    }
    
    // Cek status di Hiay
    const response = await axios.get(`${HIAY_API_URL}/status`, {
      params: {
        trxid: payment.paymentId,
        apikey: HIAY_API_KEY
      },
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (response.data.success && response.data.data.status === 'success') {
      // Update status pembayaran
      payment.status = 'paid';
      
      // Update status order
      const order = storage.orders.find(o => o.id == orderId);
      if (order) {
        order.status = 'processing';
        
        // Proses order ke Indo SMM
        try {
          const smmResponse = await axios.post(INDO_SMM_API, {
            key: INDO_SMM_KEY,
            action: 'add',
            service: order.serviceId,
            link: order.link,
            quantity: order.quantity
          });
          
          if (smmResponse.data.order) {
            order.status = 'completed';
            order.smmOrderId = smmResponse.data.order;
            order.completedAt = new Date();
          }
        } catch (smmError) {
          console.error('Gagal memproses ke Indo SMM:', smmError.message);
          order.status = 'failed';
          order.error = smmError.message;
        }
      }
      
      return res.json({
        success: true,
        paid: true,
        orderStatus: order?.status || 'unknown'
      });
    }
    
    res.json({
      success: true,
      paid: false,
      paymentStatus: payment.status
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Gagal memeriksa pembayaran' });
  }
});

// Route lainnya
app.use((req, res, next) => {
  if (path.extname(req.path) === '') {
    const htmlPath = path.join(__dirname, 'public', req.path + '.html');
    fs.access(htmlPath, fs.constants.F_OK, (err) => {
      if (!err) res.sendFile(htmlPath);
      else next();
    });
  } else next();
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server berjalan di port ${port}`);
});