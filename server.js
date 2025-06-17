require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
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

// API Proxy Endpoints
const API_URL = 'https://indosmm.id/api/v2';

// Middleware to verify API key
const verifyApiKey = (req, res, next) => {
  if (!req.body.key && !req.query.key) {
    return res.status(400).json({ error: 'API key is required' });
  }
  next();
};

// Get services
app.post('/api/services', verifyApiKey, async (req, res) => {
  try {
    const response = await axios.post(API_URL, {
      key: req.body.key,
      action: 'services'
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add order
app.post('/api/order', verifyApiKey, async (req, res) => {
  try {
    const response = await axios.post(API_URL, {
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

// Check order status
app.post('/api/order/status', verifyApiKey, async (req, res) => {
  try {
    const response = await axios.post(API_URL, {
      key: req.body.key,
      action: 'status',
      order: req.body.order
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check balance
app.post('/api/balance', verifyApiKey, async (req, res) => {
  try {
    const response = await axios.post(API_URL, {
      key: req.body.key,
      action: 'balance'
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refill order
app.post('/api/order/refill', verifyApiKey, async (req, res) => {
  try {
    const response = await axios.post(API_URL, {
      key: req.body.key,
      action: 'refill',
      order: req.body.order
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel order
app.post('/api/order/cancel', verifyApiKey, async (req, res) => {
  try {
    const response = await axios.post(API_URL, {
      key: req.body.key,
      action: 'cancel',
      orders: req.body.orders
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Handle all other routes by serving the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});