document.addEventListener('DOMContentLoaded', function() {
  const checkPaymentBtn = document.getElementById('check-payment');
  const paymentStatus = document.getElementById('payment-status');
  const statusMessage = document.getElementById('status-message');
  
  checkPaymentBtn.addEventListener('click', async function() {
    if (!currentOrder) return;
    
    paymentStatus.classList.remove('hidden');
    statusMessage.textContent = 'Memeriksa status pembayaran...';
    
    try {
      const response = await fetch(`/api/payment/status/${currentOrder.payment.transactionId}`);
      if (!response.ok) throw new Error('Gagal memeriksa status');
      
      const statusData = await response.json();
      
      if (statusData.success && statusData.data.status === 'success') {
        statusMessage.innerHTML = `
          <strong style="color: green;">PEMBAYARAN BERHASIL!</strong><br><br>
          ID Transaksi: ${currentOrder.payment.transactionId}<br>
          Saldo Masuk: Rp${parseInt(statusData.data.saldo_masuk).toLocaleString()}<br><br>
          Pesanan Anda sedang diproses. Order ID: ${currentOrder.orderId}
        `;
        
        // Nonaktifkan tombol setelah pembayaran berhasil
        checkPaymentBtn.disabled = true;
      } else {
        statusMessage.innerHTML = `
          <strong style="color: orange;">MENUNGGU PEMBAYARAN</strong><br><br>
          Status: ${statusData.data?.status || 'Belum dibayar'}<br>
          Silakan selesaikan pembayaran sebelum ${currentOrder.payment.expiredAt}
        `;
      }
    } catch (error) {
      console.error('Error:', error);
      statusMessage.textContent = 'Gagal memeriksa status pembayaran. Silakan coba lagi.';
    }
  });
});