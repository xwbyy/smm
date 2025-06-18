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

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html']
});

// API Proxy Endpoint
app.post('/api/proxy', async (req, res) => {
  try {
    const { action, ...params } = req.body;
    const apiUrl = 'https://indosmm.id/api/v2';

    const response = await axios.post(apiUrl, {
      key: process.env.API_KEY || 'your-api-key',
      action,
      ...params
    });

    res.json(response.data);
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ error: 'Failed to process API request' });
  }
});

// QRIS Payment Endpoint
app.post('/api/create-payment', async (req, res) => {
  try {
    const { amount } = req.body;
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
      throw new Error(response.data.message || 'Failed to create payment');
    }

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(response.data.data.qr_string)}`;

    res.json({
      success: true,
      data: {
        ...response.data.data,
        qrImageUrl
      }
    });
  } catch (error) {
    console.error('Payment Error:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to create payment'
    });
  }
});

// Handle all other routes by serving the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});