// Payment Process
function initPaymentProcess(amount) {
  const paymentSection = document.getElementById('payment-section');
  const orderSummary = document.getElementById('order-summary');
  const qrisImage = document.getElementById('qris-image');
  const qrisString = document.getElementById('qris-string');
  const copyQrisBtn = document.getElementById('copy-qris');
  const paymentExpiry = document.getElementById('payment-expiry');
  const paymentStatus = document.getElementById('payment-status');
  const checkStatusBtn = document.getElementById('check-status');
  const backToPayment = document.getElementById('back-to-payment');
  const refreshStatusBtn = document.getElementById('refresh-status');
  
  let paymentId = null;
  let checkInterval = null;
  
  // Show payment section
  paymentSection.classList.remove('hidden');
  paymentSection.scrollIntoView({ behavior: 'smooth' });
  
  // Update order summary
  orderSummary.innerHTML = `
    <h3>${currentOrder.serviceName}</h3>
    <p><strong>Link Target:</strong> ${currentOrder.link}</p>
    <p><strong>Jumlah:</strong> ${currentOrder.quantity}</p>
    <p><strong>Total Pembayaran:</strong> Rp${(currentOrder.amount * 1000).toLocaleString('id-ID')}</p>
    <p><strong>ID Pesanan:</strong> ${currentOrder.id}</p>
  `;
  
  // Create payment
  fetch('/api/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderId: currentOrder.id,
      amount: currentOrder.amount
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      paymentId = data.paymentId;
      
      // Show QR code
      qrisImage.src = data.qrImage;
      qrisString.value = data.qrString;
      paymentExpiry.textContent = data.expiredAt;
      
      // Start checking payment status
      startPaymentStatusCheck();
    } else {
      paymentStatus.textContent = 'Gagal membuat pembayaran: ' + (data.error || 'Unknown error');
      paymentStatus.style.color = 'var(--danger)';
    }
  })
  .catch(error => {
    console.error('Payment error:', error);
    paymentStatus.textContent = 'Terjadi kesalahan saat membuat pembayaran';
    paymentStatus.style.color = 'var(--danger)';
  });
  
  // Copy QR string
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
  
  // Check payment status
  checkStatusBtn.addEventListener('click', checkPaymentStatus);
  
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
    
    fetch(`/api/payments/${paymentId}/status`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          if (data.status === 'paid') {
            paymentStatus.textContent = 'Pembayaran berhasil!';
            paymentStatus.style.color = 'var(--success)';
            
            // Stop checking
            clearInterval(checkInterval);
            
            // Update button
            checkStatusBtn.innerHTML = '<i class="fas fa-check"></i> Berhasil';
            checkStatusBtn.style.background = 'var(--success)';
            
            // Show order status
            setTimeout(() => {
              showOrderStatus();
            }, 1500);
          } else {
            paymentStatus.textContent = 'Menunggu pembayaran...';
            paymentStatus.style.color = 'inherit';
            checkStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Periksa Status';
          }
        } else {
          paymentStatus.textContent = 'Gagal memeriksa status: ' + (data.error || 'Unknown error');
          paymentStatus.style.color = 'var(--danger)';
          checkStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Coba Lagi';
        }
      })
      .catch(error => {
        console.error('Payment status error:', error);
        paymentStatus.textContent = 'Terjadi kesalahan saat memeriksa status';
        paymentStatus.style.color = 'var(--danger)';
        checkStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Coba Lagi';
      });
  }
  
  // Show order status
  function showOrderStatus() {
    document.getElementById('status-service-name').textContent = currentOrder.serviceName;
    document.getElementById('status-order-id').textContent = currentOrder.id;
    document.getElementById('status-link').textContent = currentOrder.link;
    document.getElementById('status-quantity').textContent = currentOrder.quantity;
    document.getElementById('status-price').textContent = `Rp${(currentOrder.amount * 1000).toLocaleString('id-ID')}`;
    
    // Initial status
    updateOrderStatus();
    
    // Show status section
    document.getElementById('services-section').classList.add('hidden');
    document.getElementById('order-section').classList.add('hidden');
    document.getElementById('payment-section').classList.add('hidden');
    document.getElementById('status-section').classList.remove('hidden');
    
    // Set up refresh button
    refreshStatusBtn.addEventListener('click', updateOrderStatus);
  }
  
  // Update order status
  function updateOrderStatus() {
    refreshStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memperbarui...';
    
    fetch(`/api/orders/${currentOrder.id}/status`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          const statusBadge = document.getElementById('status-badge');
          statusBadge.textContent = data.status;
          statusBadge.className = 'status-badge ' + data.status;
          
          document.getElementById('completed-count').textContent = data.completed;
          document.getElementById('remaining-count').textContent = data.remains;
          
          const progress = (data.completed / currentOrder.quantity) * 100;
          document.getElementById('progress-fill').style.width = `${progress}%`;
        } else {
          alert('Gagal memuat status: ' + (data.error || 'Unknown error'));
        }
      })
      .catch(error => {
        console.error('Order status error:', error);
        alert('Terjadi kesalahan saat memuat status');
      })
      .finally(() => {
        refreshStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Perbarui Status';
      });
  }
  
  // Clean up on page leave
  window.addEventListener('beforeunload', function() {
    if (checkInterval) clearInterval(checkInterval);
  });
}