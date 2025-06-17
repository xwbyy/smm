const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const qr = require('qr-image');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html']
}));

// Konfigurasi API
const INDO_SMM_API = {
  key: '4e59a83d29629d875f9eaa48134d630d',
  url: 'https://indosmm.id/api/v2'
};

const PAYMENT_API = {
  key: 'Fupei-pedia-l3p5q04yqvppzw22',
  url: 'https://fupei-pedia.web.id/api/v1/deposit'
};

// Markup harga (dalam persen)
const PRICE_MARKUP = 20; // 20% markup

// Simpan data sementara di memory
const orders = {};
const payments = {};
const servicesCache = {
  data: null,
  lastUpdated: null
};

// Endpoint untuk layanan SMM
app.get('/api/services', async (req, res) => {
  try {
    // Gunakan cache jika tersedia dan belum kadaluarsa (5 menit)
    if (servicesCache.data && Date.now() - servicesCache.lastUpdated < 300000) {
      return res.json(servicesCache.data);
    }

    const response = await axios.get(INDO_SMM_API.url, {
      params: {
        key: INDO_SMM_API.key,
        action: 'services'
      }
    });

    // Tambahkan markup harga dan simpan ke cache
    const servicesWithMarkup = response.data.map(service => ({
      ...service,
      originalRate: service.rate,
      rate: (parseFloat(service.rate) * (1 + PRICE_MARKUP / 100)).toFixed(2)
    }));

    servicesCache.data = servicesWithMarkup;
    servicesCache.lastUpdated = Date.now();

    res.json(servicesWithMarkup);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Gagal memuat layanan' });
  }
});

// Endpoint untuk kategori layanan
app.get('/api/categories', async (req, res) => {
  try {
    const services = servicesCache.data || (await axios.get(`${INDO_SMM_API.url}?key=${INDO_SMM_API.key}&action=services`)).data;
    
    const categories = [...new Set(services.map(service => service.category))];
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Gagal memuat kategori' });
  }
});

// Endpoint untuk membuat pesanan
app.post('/api/order', async (req, res) => {
  const { serviceId, link, quantity } = req.body;

  try {
    // Dapatkan detail layanan untuk memverifikasi
    const service = servicesCache.data.find(s => s.service == serviceId);
    if (!service) {
      return res.status(400).json({ error: 'Layanan tidak ditemukan' });
    }

    // Buat pesanan ke Indo SMM
    const orderResponse = await axios.get(INDO_SMM_API.url, {
      params: {
        key: INDO_SMM_API.key,
        action: 'add',
        service: serviceId,
        link,
        quantity
      }
    });

    const orderId = orderResponse.data.order;
    const totalPrice = (service.rate * quantity).toFixed(2);

    // Simpan order sementara
    orders[orderId] = {
      serviceId,
      serviceName: service.name,
      link,
      quantity,
      price: totalPrice,
      status: 'pending_payment',
      createdAt: new Date()
    };

    res.json({ 
      success: true, 
      orderId,
      amount: totalPrice,
      serviceName: service.name
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Gagal membuat pesanan' });
  }
});

// Endpoint untuk pembayaran QRIS
app.post('/api/create-payment', async (req, res) => {
  const { orderId, amount } = req.body;

  try {
    // Verifikasi order
    if (!orders[orderId]) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    // Buat pembayaran ke Hiay Payment
    const paymentResponse = await axios.get(`${PAYMENT_API.url}/create`, {
      params: {
        nominal: amount,
        apikey: PAYMENT_API.key
      },
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!paymentResponse.data.success) {
      return res.status(400).json({ error: paymentResponse.data.message || 'Gagal membuat pembayaran' });
    }

    const paymentData = paymentResponse.data.data;
    const qrImage = qr.imageSync(paymentData.qr_string, { type: 'png' });

    // Simpan data pembayaran
    payments[paymentData.reff_id] = {
      orderId,
      paymentId: paymentData.id,
      amount: paymentData.nominal,
      qrString: paymentData.qr_string,
      expiredAt: paymentData.expired_at,
      status: 'pending'
    };

    res.json({
      success: true,
      paymentId: paymentData.reff_id,
      qrImage: `data:image/png;base64,${qrImage.toString('base64')}`,
      qrString: paymentData.qr_string,
      amount: paymentData.nominal,
      expiredAt: paymentData.expired_at
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Gagal membuat pembayaran' });
  }
});

// Endpoint untuk cek status pembayaran
app.get('/api/check-payment/:paymentId', async (req, res) => {
  const { paymentId } = req.params;

  try {
    // Cek di local storage dulu
    if (payments[paymentId] && payments[paymentId].status === 'paid') {
      return res.json({ 
        success: true, 
        status: 'paid',
        orderId: payments[paymentId].orderId
      });
    }

    // Cek ke payment gateway
    const statusResponse = await axios.get(`${PAYMENT_API.url}/status`, {
      params: {
        trxid: payments[paymentId]?.paymentId,
        apikey: PAYMENT_API.key
      },
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (statusResponse.data.success && statusResponse.data.data.status === 'success') {
      // Update status pembayaran
      payments[paymentId].status = 'paid';
      
      // Update status order
      const orderId = payments[paymentId].orderId;
      if (orders[orderId]) {
        orders[orderId].status = 'processing';
      }

      return res.json({ 
        success: true, 
        status: 'paid',
        orderId
      });
    }

    res.json({ 
      success: true, 
      status: payments[paymentId]?.status || 'pending'
    });
  } catch (error) {
    console.error('Error checking payment:', error);
    res.status(500).json({ error: 'Gagal memeriksa status pembayaran' });
  }
});

// Middleware untuk halaman HTML
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

// Default route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server berjalan di port ${port}`);
});