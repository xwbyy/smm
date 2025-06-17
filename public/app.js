document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const orderForm = document.getElementById('orderForm');
  const orderFormSection = document.getElementById('orderFormSection');
  const paymentSection = document.getElementById('paymentSection');
  const orderStatusSection = document.getElementById('orderStatusSection');
  const serviceSelect = document.getElementById('service');
  const quantityInput = document.getElementById('quantity');
  const quantityInfo = document.getElementById('quantityInfo');
  const priceSummary = document.getElementById('priceSummary');
  const submitBtn = document.getElementById('submitBtn');
  const confirmOrderBtn = document.getElementById('confirmOrderBtn');
  
  // Variabel state
  let currentOrder = null;
  let services = [];
  
  // Inisialisasi
  loadServices();
  setupEventListeners();
  
  // Fungsi untuk memuat layanan dari server
  async function loadServices() {
    try {
      const response = await fetch('/api/services');
      const data = await response.json();
      
      if (data.success && data.services.length > 0) {
        services = data.services;
        renderServices();
      } else {
        serviceSelect.innerHTML = '<option value="">Gagal memuat layanan</option>';
      }
    } catch (error) {
      console.error('Gagal memuat layanan:', error);
      serviceSelect.innerHTML = '<option value="">Gagal memuat layanan</option>';
    }
  }
  
  // Fungsi untuk menampilkan layanan di dropdown
  function renderServices() {
    serviceSelect.innerHTML = '<option value="">Pilih Layanan</option>';
    
    services.forEach(service => {
      const option = document.createElement('option');
      option.value = service.service;
      option.textContent = `${service.name} (Rp${(service.rate * 1.1).toFixed(2)}/1000)`;
      serviceSelect.appendChild(option);
    });
  }
  
  // Fungsi untuk setup event listeners
  function setupEventListeners() {
    // Ketika layanan dipilih, update quantity info
    serviceSelect.addEventListener('change', function() {
      const serviceId = this.value;
      const service = services.find(s => s.service == serviceId);
      
      if (service) {
        quantityInfo.textContent = `Min: ${service.min}, Max: ${service.max}`;
        quantityInput.min = service.min;
        quantityInput.max = service.max;
        quantityInput.value = service.min;
      } else {
        quantityInfo.textContent = 'Min: -, Max: -';
      }
      
      priceSummary.classList.add('hidden');
    });
    
    // Form submit (hitung harga)
    orderForm.addEventListener('submit', function(e) {
      e.preventDefault();
      calculatePrice();
    });
    
    // Konfirmasi order
    confirmOrderBtn.addEventListener('click', createOrder);
    
    // Cek status pembayaran
    document.getElementById('checkPaymentBtn').addEventListener('click', checkPaymentStatus);
  }
  
  // Fungsi untuk menghitung harga
  function calculatePrice() {
    const serviceId = serviceSelect.value;
    const quantity = parseInt(quantityInput.value);
    
    if (!serviceId || isNaN(quantity)) {
      alert('Harap pilih layanan dan masukkan jumlah yang valid');
      return;
    }
    
    const service = services.find(s => s.service == serviceId);
    if (!service) return;
    
    // Validasi quantity
    if (quantity < service.min || quantity > service.max) {
      alert(`Jumlah harus antara ${service.min} - ${service.max}`);
      return;
    }
    
    // Hitung harga dengan markup 10%
    const rate = parseFloat(service.rate) * 1.1;
    const totalPrice = Math.ceil((rate * quantity / 1000));
    
    // Update UI
    document.getElementById('rate').textContent = rate.toFixed(2);
    document.getElementById('totalPrice').textContent = totalPrice.toLocaleString('id-ID');
    
    // Tampilkan summary harga
    priceSummary.classList.remove('hidden');
    submitBtn.textContent = 'Hitung Ulang';
  }
  
  // Fungsi untuk membuat order
  async function createOrder() {
    const serviceId = serviceSelect.value;
    const link = document.getElementById('link').value;
    const quantity = parseInt(quantityInput.value);
    
    if (!serviceId || !link || isNaN(quantity)) {
      alert('Harap lengkapi semua field');
      return;
    }
    
    const service = services.find(s => s.service == serviceId);
    if (!service) return;
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Memproses...';
      
      // Hitung harga
      const rate = parseFloat(service.rate) * 1.1;
      const totalPrice = Math.ceil((rate * quantity / 1000));
      
      // Buat order ke server
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service: serviceId,
          link,
          quantity
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        currentOrder = {
          id: data.orderId,
          serviceId,
          serviceName: service.name,
          link,
          quantity,
          price: totalPrice
        };
        
        // Tampilkan halaman pembayaran
        showPaymentPage(data.orderId, totalPrice);
      } else {
        alert(data.message || 'Gagal membuat order');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan saat membuat order');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Hitung Ulang';
    }
  }
  
  // Fungsi untuk menampilkan halaman pembayaran
  async function showPaymentPage(orderId, amount) {
    try {
      // Buat pembayaran QRIS
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
        // Update UI dengan data order
        document.getElementById('orderService').textContent = currentOrder.serviceName;
        document.getElementById('orderLink').textContent = currentOrder.link;
        document.getElementById('orderQuantity').textContent = currentOrder.quantity.toLocaleString('id-ID');
        document.getElementById('orderTotal').textContent = currentOrder.price.toLocaleString('id-ID');
        
        // Update UI dengan data pembayaran
        document.getElementById('qrisImage').src = data.qrImageUrl;
        document.getElementById('paymentId').textContent = data.paymentData.reffId;
        document.getElementById('paymentExpiry').textContent = data.paymentData.expiredAt;
        
        // Sembunyikan form, tampilkan payment section
        orderFormSection.classList.add('hidden');
        paymentSection.classList.remove('hidden');
        
        // Mulai cek status pembayaran otomatis
        startPaymentStatusChecker(orderId);
      } else {
        alert(data.message || 'Gagal membuat pembayaran');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan saat membuat pembayaran');
    }
  }
  
  // Fungsi untuk memulai pengecekan status pembayaran otomatis
  function startPaymentStatusChecker(orderId) {
    // Cek setiap 10 detik
    const intervalId = setInterval(() => {
      checkPaymentStatus(orderId, intervalId);
    }, 10000);
  }
  
  // Fungsi untuk mengecek status pembayaran
  async function checkPaymentStatus(orderId, intervalId = null) {
    try {
      const response = await fetch(`/api/check-payment/${orderId}`);
      const data = await response.json();
      
      if (data.success) {
        if (data.paid) {
          // Pembayaran berhasil
          document.getElementById('paymentStatus').textContent = 'Dibayar';
          document.getElementById('paymentStatus').className = 'paid';
          
          // Hentikan interval jika ada
          if (intervalId) {
            clearInterval(intervalId);
          }
          
          // Tampilkan status order
          showOrderStatus(orderId);
        } else {
          // Update status pembayaran
          const statusText = data.paymentStatus === 'pending' ? 'Menunggu Pembayaran' : 'Pending';
          document.getElementById('paymentStatus').textContent = statusText;
          document.getElementById('paymentStatus').className = 'pending';
        }
      } else {
        alert(data.message || 'Gagal memeriksa status pembayaran');
      }
    } catch (error) {
      console.error('Error:', error);
      document.getElementById('paymentStatus').textContent = 'Error';
      document.getElementById('paymentStatus').className = 'failed';
    }
  }
  
  // Fungsi untuk menampilkan status order
  function showOrderStatus(orderId) {
    // Update UI dengan data order
    document.getElementById('displayOrderId').textContent = orderId;
    document.getElementById('displayService').textContent = currentOrder.serviceName;
    document.getElementById('displayLink').textContent = currentOrder.link;
    document.getElementById('displayQuantity').textContent = currentOrder.quantity.toLocaleString('id-ID');
    document.getElementById('displayTotal').textContent = currentOrder.price.toLocaleString('id-ID');
    document.getElementById('displayOrderTime').textContent = new Date().toLocaleString('id-ID');
    
    // Status awal
    document.getElementById('displayOrderStatus').textContent = 'Diproses';
    document.getElementById('displayOrderStatus').className = 'processing';
    
    // Sembunyikan payment section, tampilkan order status
    paymentSection.classList.add('hidden');
    orderStatusSection.classList.remove('hidden');
    
    // Cek status order dari server secara berkala
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/api/check-payment/${orderId}`);
        const data = await response.json();
        
        if (data.success && data.orderStatus) {
          // Update status order
          let statusText = '';
          let statusClass = '';
          
          switch(data.orderStatus) {
            case 'completed':
              statusText = 'Selesai';
              statusClass = 'completed';
              document.getElementById('orderSuccessMessage').classList.remove('hidden');
              clearInterval(intervalId);
              break;
            case 'failed':
              statusText = 'Gagal';
              statusClass = 'failed';
              clearInterval(intervalId);
              break;
            default:
              statusText = 'Diproses';
              statusClass = 'processing';
          }
          
          document.getElementById('displayOrderStatus').textContent = statusText;
          document.getElementById('displayOrderStatus').className = statusClass;
        }
      } catch (error) {
        console.error('Gagal memeriksa status order:', error);
      }
    }, 15000);
  }
});