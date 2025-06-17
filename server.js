require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const qr = require('qr-image');
const app = express();
const port = process.env.PORT || 3000;

// Konfigurasi API
const SMM_API_KEY = '4e59a83d29629d875f9eaa48134d630d';
const SMM_API_URL = 'https://indosmm.id/api/v2';
const PAYMENT_API_KEY = 'Fupei-pedia-l3p5q04yqvppzw22';
const PAYMENT_API_URL = 'https://fupei-pedia.web.id/api/v1/deposit';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html']
}));

// Middleware untuk verifikasi API key
const verifyApiKey = (req, res, next) => {
  if (!req.body.key && !req.query.key) {
    return res.status(400).json({ error: 'API key diperlukan' });
  }
  next();
};

// Endpoint untuk layanan SMM
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

// Endpoint untuk membuat pesanan
app.post('/api/order', verifyApiKey, async (req, res) => {
  try {
    const response = await axios.post(SMM_API_URL, {
      key: req.body.key,
      action: 'add',
      service: req.body.service,
      link: req.body.link,
      quantity: req.body.quantity,
      runs: req.body.runs,
      interval: req.body.interval
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint untuk status pesanan
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

// Endpoint untuk saldo
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

// Endpoint untuk pembayaran
app.post('/api/payment', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 1000) {
      return res.status(400).json({ error: 'Jumlah minimal deposit adalah 1000' });
    }

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
      return res.status(400).json({ error: response.data.message || 'Gagal membuat transaksi' });
    }

    const trx = response.data.data;
    const qrCode = qr.imageSync(trx.qr_string, { type: 'png' });

    res.json({
      success: true,
      transaction: {
        id: trx.id,
        reff_id: trx.reff_id,
        amount: trx.nominal,
        fee: trx.fee,
        received: trx.get_balance,
        expired_at: trx.expired_at,
        qr_string: trx.qr_string,
        qr_code: qrCode.toString('base64')
      }
    });
  } catch (error) {
    console.error('Error pembayaran:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses pembayaran' });
  }
});

// Endpoint untuk cek status pembayaran
app.get('/api/payment/status', async (req, res) => {
  try {
    const { trxid } = req.query;
    if (!trxid) {
      return res.status(400).json({ error: 'ID transaksi diperlukan' });
    }

    const response = await axios.get(`${PAYMENT_API_URL}/status`, {
      params: {
        trxid: trxid,
        apikey: PAYMENT_API_KEY
      },
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error cek status:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa status' });
  }
});

// Handle semua route lainnya dengan index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server berjalan di port ${port}`);
});