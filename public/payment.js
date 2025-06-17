// Inisialisasi proses pembayaran
function initPaymentProcess() {
  const qrisImage = document.getElementById('qris-image');
  const qrisString = document.getElementById('qris-string');
  const copyQrisBtn = document.getElementById('copy-qris');
  const checkStatusBtn = document.getElementById('check-status');
  const statusText = document.getElementById('status-text');
  
  let paymentId = null;
  let checkInterval = null;

  // Buat pembayaran QRIS
  fetch('/api/create-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderId: currentOrder.orderId,
      amount: currentOrder.amount
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      paymentId = data.paymentId;
      
      // Tampilkan QR code
      qrisImage.src = data.qrImage;
      qrisString.value = data.qrString;
      
      // Mulai pengecekan status otomatis
      startPaymentStatusCheck();
    } else {
      statusText.textContent = 'Gagal membuat pembayaran: ' + (data.error || 'Unknown error');
    }
  })
  .catch(error => {
    console.error('Error creating payment:', error);
    statusText.textContent = 'Terjadi kesalahan saat membuat pembayaran';
  });

  // Tombol salin QR string
  copyQrisBtn.addEventListener('click', function() {
    qrisString.select();
    document.execCommand('copy');
    alert('QR string telah disalin!');
  });

  // Tombol cek status manual
  checkStatusBtn.addEventListener('click', function() {
    checkPaymentStatus();
  });

  // Fungsi untuk memulai pengecekan status otomatis
  function startPaymentStatusCheck() {
    // Hentikan interval sebelumnya jika ada
    if (checkInterval) clearInterval(checkInterval);
    
    // Cek setiap 10 detik
    checkInterval = setInterval(checkPaymentStatus, 10000);
    
    // Juga cek segera
    checkPaymentStatus();
  }

  // Fungsi untuk memeriksa status pembayaran
  function checkPaymentStatus() {
    if (!paymentId) return;
    
    fetch(`/api/check-payment/${paymentId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          if (data.status === 'paid') {
            statusText.textContent = 'Pembayaran berhasil! Pesanan sedang diproses.';
            statusText.style.color = 'green';
            
            // Hentikan pengecekan
            clearInterval(checkInterval);
            
            // Tampilkan pesan sukses
            alert('Pembayaran berhasil! Pesanan Anda sedang diproses.');
          } else {
            statusText.textContent = 'Menunggu pembayaran...';
            statusText.style.color = 'inherit';
          }
        } else {
          statusText.textContent = 'Gagal memeriksa status: ' + (data.error || 'Unknown error');
          statusText.style.color = 'red';
        }
      })
      .catch(error => {
        console.error('Error checking payment status:', error);
        statusText.textContent = 'Terjadi kesalahan saat memeriksa status';
        statusText.style.color = 'red';
      });
  }

  // Hentikan interval saat meninggalkan halaman
  window.addEventListener('beforeunload', function() {
    if (checkInterval) clearInterval(checkInterval);
  });
}