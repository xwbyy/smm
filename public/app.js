document.addEventListener('DOMContentLoaded', function() {
  const orderForm = document.getElementById('orderForm');
  const paymentSection = document.getElementById('paymentSection');
  const orderStatusSection = document.getElementById('orderStatusSection');
  
  // Harga layanan (dalam Rupiah)
  const servicePrices = {
    '1': 900,    // Followers Instagram
    '2': 800,    // Likes Instagram
    '3': 500,    // Views YouTube
    '4': 1500    // Subscribers YouTube
  };
  
  // Nama layanan
  const serviceNames = {
    '1': 'Followers Instagram',
    '2': 'Likes Instagram',
    '3': 'Views YouTube',
    '4': 'Subscribers YouTube'
  };
  
  // Handle form submission
  orderForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const service = document.getElementById('service').value;
    const link = document.getElementById('link').value;
    const quantity = document.getElementById('quantity').value;
    
    // Validasi input
    if (!service || !link || !quantity) {
      alert('Harap isi semua field!');
      return;
    }
    
    // Buat order
    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service,
          link,
          quantity
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Tampilkan section pembayaran
        showPaymentSection(service, link, quantity, data.orderId);
      } else {
        alert('Gagal membuat order: ' + (data.message || 'Terjadi kesalahan'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan saat memproses order');
    }
  });
  
  // Fungsi untuk menampilkan section pembayaran
  function showPaymentSection(service, link, quantity, orderId) {
    // Hitung total harga
    const unitPrice = servicePrices[service] || 0;
    const totalPrice = unitPrice * quantity;
    
    // Update UI
    document.getElementById('serviceName').textContent = serviceNames[service] || 'Unknown';
    document.getElementById('targetLink').textContent = link;
    document.getElementById('orderQuantity').textContent = quantity;
    document.getElementById('totalPrice').textContent = totalPrice.toLocaleString('id-ID');
    
    // Sembunyikan form order, tampilkan payment section
    orderForm.classList.add('hidden');
    paymentSection.classList.remove('hidden');
    
    // Buat pembayaran QRIS
    createQRISPayment(orderId, totalPrice);
  }
  
  // Fungsi untuk membuat pembayaran QRIS
  async function createQRISPayment(orderId, amount) {
    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId,
          amount
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Tampilkan QR code
        document.getElementById('qrisImage').src = data.qrImageUrl;
        document.getElementById('paymentId').textContent = data.paymentData.reffId;
        document.getElementById('paymentExpiry').textContent = data.paymentData.expiredAt;
        
        // Setup tombol cek pembayaran
        document.getElementById('checkPaymentBtn').addEventListener('click', function() {
          checkPaymentStatus(orderId);
        });
        
        // Cek status pembayaran otomatis setiap 10 detik
        const intervalId = setInterval(() => {
          checkPaymentStatus(orderId, intervalId);
        }, 10000);
      } else {
        alert('Gagal membuat pembayaran: ' + (data.message || 'Terjadi kesalahan'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan saat membuat pembayaran');
    }
  }
  
  // Fungsi untuk mengecek status pembayaran
  async function checkPaymentStatus(orderId, intervalId = null) {
    try {
      const response = await fetch(`/api/check-payment/${orderId}`);
      const data = await response.json();
      
      if (data.success) {
        if (data.paid) {
          // Pembayaran berhasil
          document.getElementById('paymentStatus').textContent = 'Pembayaran Berhasil';
          document.getElementById('paymentStatus').style.color = 'green';
          
          // Hentikan interval jika ada
          if (intervalId) {
            clearInterval(intervalId);
          }
          
          // Tampilkan status order
          showOrderStatus(orderId);
        } else {
          // Pembayaran masih pending
          document.getElementById('paymentStatus').textContent = 'Menunggu Pembayaran';
          document.getElementById('paymentStatus').style.color = 'orange';
        }
      } else {
        alert('Gagal memeriksa status pembayaran: ' + (data.message || 'Terjadi kesalahan'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan saat memeriksa status pembayaran');
    }
  }
  
  // Fungsi untuk menampilkan status order
  function showOrderStatus(orderId) {
    // Sembunyikan payment section, tampilkan order status
    paymentSection.classList.add('hidden');
    orderStatusSection.classList.remove('hidden');
    
    // Update UI dengan data order
    document.getElementById('orderIdDisplay').textContent = orderId;
    document.getElementById('orderStatus').textContent = 'Diproses';
    document.getElementById('orderDate').textContent = new Date().toLocaleString('id-ID');
  }
});