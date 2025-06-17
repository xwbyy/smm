// Payment Process
function initPaymentProcess(amount) {
  const orderSection = document.getElementById('order-section');
  const paymentSection = document.getElementById('payment-section');
  const orderSummary = document.getElementById('order-summary');
  const qrisImage = document.getElementById('qris-image');
  const qrisString = document.getElementById('qris-string');
  const copyQrisBtn = document.getElementById('copy-qris');
  const expiryTime = document.getElementById('expiry-time');
  const paymentStatus = document.getElementById('payment-status');
  const checkStatusBtn = document.getElementById('check-status-btn');
  
  let paymentId = null;
  let checkInterval = null;
  
  // Show payment section
  orderSection.classList.add('hidden');
  paymentSection.classList.remove('hidden');
  paymentSection.scrollIntoView({ behavior: 'smooth' });
  
  // Update order summary
  orderSummary.innerHTML = `
    <h3>${currentOrder.serviceName}</h3>
    <p><strong>Link Target:</strong> ${currentOrder.link}</p>
    <p><strong>Jumlah:</strong> ${currentOrder.quantity}</p>
    <p><strong>Total Pembayaran:</strong> Rp${(currentOrder.amount * 1000).toLocaleString('id-ID')}</p>
    <p><strong>ID Pesanan:</strong> ${currentOrder.orderId}</p>
  `;
  
  // Create payment
  fetch('/api/create-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderId: currentOrder.orderId,
      amount: currentOrder.amount * 1000 // Convert to Rupiah
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      paymentId = data.paymentId;
      
      // Show QR code
      qrisImage.src = data.qrImage;
      qrisString.value = data.qrString;
      expiryTime.textContent = data.expiredAt;
      
      // Start checking payment status
      startPaymentStatusCheck();
    } else {
      paymentStatus.textContent = 'Gagal membuat pembayaran: ' + (data.error || 'Unknown error');
      paymentStatus.style.color = 'red';
    }
  })
  .catch(error => {
    console.error('Error creating payment:', error);
    paymentStatus.textContent = 'Terjadi kesalahan saat membuat pembayaran';
    paymentStatus.style.color = 'red';
  });
  
  // Copy QR string button
  copyQrisBtn.addEventListener('click', function() {
    qrisString.select();
    document.execCommand('copy');
    
    // Show feedback
    const originalText = copyQrisBtn.innerHTML;
    copyQrisBtn.innerHTML = '<i class="fas fa-check"></i> Tersalin!';
    
    setTimeout(() => {
      copyQrisBtn.innerHTML = originalText;
    }, 2000);
  });
  
  // Check status button
  checkStatusBtn.addEventListener('click', function() {
    checkPaymentStatus();
  });
  
  // Start payment status check
  function startPaymentStatusCheck() {
    // Clear previous interval if any
    if (checkInterval) clearInterval(checkInterval);
    
    // Check every 10 seconds
    checkInterval = setInterval(checkPaymentStatus, 10000);
    
    // Also check immediately
    checkPaymentStatus();
  }
  
  // Check payment status
  function checkPaymentStatus() {
    if (!paymentId) return;
    
    checkStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...';
    
    fetch(`/api/check-payment/${paymentId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          if (data.status === 'paid') {
            paymentStatus.textContent = 'Pembayaran berhasil! Pesanan sedang diproses.';
            paymentStatus.style.color = 'green';
            
            // Stop checking
            clearInterval(checkInterval);
            
            // Update button
            checkStatusBtn.innerHTML = '<i class="fas fa-check"></i> Pembayaran Berhasil';
            checkStatusBtn.style.backgroundColor = '#2e7d32';
            
            // Show success message
            setTimeout(() => {
              alert('Pembayaran berhasil! Pesanan Anda sedang diproses.');
            }, 500);
          } else {
            paymentStatus.textContent = 'Menunggu pembayaran...';
            paymentStatus.style.color = 'inherit';
            checkStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Periksa Status';
          }
        } else {
          paymentStatus.textContent = 'Gagal memeriksa status: ' + (data.error || 'Unknown error');
          paymentStatus.style.color = 'red';
          checkStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Coba Lagi';
        }
      })
      .catch(error => {
        console.error('Error checking payment:', error);
        paymentStatus.textContent = 'Terjadi kesalahan saat memeriksa status';
        paymentStatus.style.color = 'red';
        checkStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Coba Lagi';
      });
  }
  
  // Stop interval when leaving page
  window.addEventListener('beforeunload', function() {
    if (checkInterval) clearInterval(checkInterval);
  });
}