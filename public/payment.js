// Payment handling functions
async function processPayment(orderData) {
  try {
    // Create payment request
    const paymentResponse = await axios.get(`${PAYMENT_API_URL}/create`, {
      params: {
        nominal: orderData.amount,
        apikey: PAYMENT_API_KEY
      },
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!paymentResponse.data.success) {
      throw new Error(paymentResponse.data.message || 'Payment creation failed');
    }

    const paymentData = paymentResponse.data.data;
    
    // Generate QR code
    const qrImage = generateQR(paymentData.qr_string);
    
    return {
      success: true,
      payment: {
        id: paymentData.id,
        reffId: paymentData.reff_id,
        qrString: paymentData.qr_string,
        qrImage: qrImage ? `data:image/png;base64,${qrImage.toString('base64')}` : null,
        amount: orderData.amount,
        expiredAt: paymentData.expired_at
      }
    };
  } catch (error) {
    console.error('Payment processing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function checkPaymentStatus(paymentId) {
  try {
    const statusResponse = await axios.get(`${PAYMENT_API_URL}/status`, {
      params: {
        trxid: paymentId,
        apikey: PAYMENT_API_KEY
      },
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    return {
      success: statusResponse.data.success,
      status: statusResponse.data.data?.status || 'pending',
      message: statusResponse.data.message
    };
  } catch (error) {
    console.error('Payment status check error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}