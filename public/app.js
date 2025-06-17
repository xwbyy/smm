document.addEventListener('DOMContentLoaded', function() {
  // Elemen DOM
  const orderSection = document.getElementById('order-section');
  const paymentSection = document.getElementById('payment-section');
  const serviceSelect = document.getElementById('service-select');
  const serviceDetails = document.getElementById('service-details');
  const quantityInput = document.getElementById('quantity');
  const minQuantitySpan = document.getElementById('min-quantity');
  const maxQuantitySpan = document.getElementById('max-quantity');
  const totalPrice = document.getElementById('total-price');
  const submitOrderBtn = document.getElementById('submit-order');
  const checkStatusBtn = document.getElementById('check-status');
  const newOrderBtn = document.getElementById('new-order');
  
  // Payment elements
  const qrCodeImage = document.getElementById('qr-code-image');
  const transactionId = document.getElementById('transaction-id');
  const paymentAmount = document.getElementById('payment-amount');
  const expiryTime = document.getElementById('expiry-time');
  const paymentStatus = document.getElementById('payment-status');
  const orderService = document.getElementById('order-service');
  const orderLink = document.getElementById('order-link');
  const orderQuantity = document.getElementById('order-quantity');
  const orderId = document.getElementById('order-id');
  
  // State
  let services = [];
  let selectedService = null;
  let currentOrder = null;
  let paymentCheckInterval = null;
  
  // Inisialisasi
  loadServices();
  setupEventListeners();
  
  // Fungsi untuk memuat daftar layanan
  async function loadServices() {
    try {
      submitOrderBtn.disabled = true;
      submitOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memuat layanan...';
      
      const response = await fetch('/api/services');
      if (!response.ok) throw new Error('Gagal memuat layanan');
      
      services = await response.json();
      populateServiceSelect(services);
      
      submitOrderBtn.disabled = false;
      submitOrderBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Buat Pesanan & Bayar';
    } catch (error) {
      console.error('Error:', error);
      serviceSelect.innerHTML = '<option value="">Gagal memuat layanan. Silakan refresh halaman.</option>';
      submitOrderBtn.disabled = true;
      submitOrderBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Gagal memuat layanan';
    }
  }
  
  // Fungsi untuk mengisi dropdown layanan
  function populateServiceSelect(services) {
    serviceSelect.innerHTML = '<option value="">-- Pilih Layanan --</option>';
    
    services.forEach(service => {
      const ratePer1000 = (service.rate * 1000).toLocaleString('id-ID');
      const option = document.createElement('option');
      option.value = service.service;
      option.textContent = `${service.name} (Rp${ratePer1000}/1000)`;
      option.dataset.service = JSON.stringify(service);
      serviceSelect.appendChild(option);
    });
  }
  
  // Fungsi untuk setup event listeners
  function setupEventListeners() {
    // Pilih layanan
    serviceSelect.addEventListener('change', function() {
      if (!this.value) {
        selectedService = null;
        serviceDetails.classList.add('hidden');
        return;
      }
      
      selectedService = JSON.parse(this.selectedOptions[0].dataset.service);
      updateServiceDetails(selectedService);
      updateQuantityConstraints(selectedService);
      serviceDetails.classList.remove('hidden');
      calculateTotal();
    });
    
    // Perubahan kuantitas
    quantityInput.addEventListener('input', calculateTotal);
    
    // Submit order
    submitOrderBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      await createOrder();
    });
    
    // Cek status pembayaran
    checkStatusBtn.addEventListener('click', checkPaymentStatus);
    
    // Buat order baru
    newOrderBtn.addEventListener('click', resetOrderForm);
  }
  
  // Fungsi untuk memperbarui detail layanan
  function updateServiceDetails(service) {
    document.getElementById('service-name').textContent = service.name;
    document.getElementById('service-category').textContent = service.category;
    document.getElementById('service-rate').textContent = `Rp${(service.rate * 1000).toLocaleString('id-ID')}/1000`;
    document.getElementById('service-min').textContent = service.min;
    document.getElementById('service-max').textContent = service.max;
  }
  
  // Fungsi untuk memperbarui batasan kuantitas
  function updateQuantityConstraints(service) {
    quantityInput.min = service.min;
    quantityInput.max = service.max;
    minQuantitySpan.textContent = service.min;
    maxQuantitySpan.textContent = service.max;
    quantityInput.value = service.min;
  }
  
  // Fungsi untuk menghitung total harga
  function calculateTotal() {
    if (!selectedService) {
      totalPrice.textContent = 'Rp0';
      return;
    }
    
    const quantity = parseInt(quantityInput.value) || 0;
    const rate = parseFloat(selectedService.rate);
    const total = Math.ceil(rate * quantity * 1000); // Konversi ke Rupiah
    
    totalPrice.textContent = `Rp${total.toLocaleString('id-ID')}`;
  }
  
  // Fungsi untuk membuat order
  async function createOrder() {
    if (!selectedService) {
      alert('Silakan pilih layanan terlebih dahulu');
      return;
    }
    
    const link = document.getElementById('link').value;
    const quantity = parseInt(quantityInput.value);
    
    if (!link) {
      alert('Silakan masukkan link target');
      return;
    }
    
    if (quantity < selectedService.min || quantity > selectedService.max) {
      alert(`Jumlah harus antara ${selectedService.min} dan ${selectedService.max}`);
      return;
    }
    
    try {
      submitOrderBtn.disabled = true;
      submitOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
      
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service: selectedService.service,
          link,
          quantity
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal membuat pesanan');
      }
      
      const orderData = await response.json();
      currentOrder = orderData.order;
      showPaymentSection(currentOrder);
      
      // Mulai pengecekan status otomatis
      startPaymentStatusCheck();
      
    } catch (error) {
      console.error('Error:', error);
      alert(`Gagal membuat pesanan: ${error.message}`);
    } finally {
      submitOrderBtn.disabled = false;
      submitOrderBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Buat Pesanan & Bayar';
    }
  }
  
  // Fungsi untuk menampilkan section pembayaran
  function showPaymentSection(orderData) {
    // Update UI pembayaran
    qrCodeImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(orderData.payment.qrString)}`;
    transactionId.textContent = orderData.payment.reffId;
    paymentAmount.textContent = `Rp${orderData.payment.amount.toLocaleString('id-ID')}`;
    expiryTime.textContent = orderData.payment.expiredAt;
    
    // Update info order
    orderService.textContent = selectedService.name;
    orderLink.textContent = orderData.link;
    orderQuantity.textContent = orderData.quantity;
    orderId.textContent = orderData.orderId;
    
    // Tampilkan section pembayaran, sembunyikan form order
    orderSection.classList.add('hidden');
    paymentSection.classList.remove('hidden');
  }
  
  // Fungsi untuk memulai pengecekan status pembayaran berkala
  function startPaymentStatusCheck() {
    // Hentikan interval sebelumnya jika ada
    if (paymentCheckInterval) {
      clearInterval(paymentCheckInterval);
    }
    
    // Cek status setiap 10 detik
    paymentCheckInterval = setInterval(checkPaymentStatus, 10000);
    
    // Cek status pertama kali
    checkPaymentStatus();
  }
  
  // Fungsi untuk memeriksa status pembayaran
  async function checkPaymentStatus() {
    if (!currentOrder) return;
    
    try {
      checkStatusBtn.disabled = true;
      checkStatusBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...';
      paymentStatus.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Memeriksa status pembayaran...';
      
      const response = await fetch(`/api/payment/status/${currentOrder.payment.reffId}`);
      if (!response.ok) throw new Error('Gagal memeriksa status');
      
      const statusData = await response.json();
      
      if (statusData.status === 'success') {
        // Pembayaran berhasil
        clearInterval(paymentCheckInterval);
        paymentStatus.innerHTML = '<i class="fas fa-check-circle"></i> Pembayaran berhasil! Pesanan sedang diproses.';
        paymentStatus.className = 'status-completed';
        
        // Update UI
        checkStatusBtn.disabled = true;
        checkStatusBtn.innerHTML = '<i class="fas fa-check"></i> Pembayaran Berhasil';
      } else {
        // Masih menunggu pembayaran
        paymentStatus.innerHTML = '<i class="fas fa-clock"></i> Menunggu pembayaran...';
        paymentStatus.className = 'status-pending';
      }
    } catch (error) {
      console.error('Error:', error);
      paymentStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Gagal memeriksa status';
    } finally {
      checkStatusBtn.disabled = false;
      checkStatusBtn.innerHTML = '<i class="fas fa-sync"></i> Periksa Status';
    }
  }
  
  // Fungsi untuk reset form order
  function resetOrderForm() {
    // Hentikan pengecekan status
    if (paymentCheckInterval) {
      clearInterval(paymentCheckInterval);
      paymentCheckInterval = null;
    }
    
    // Reset form
    serviceSelect.value = '';
    document.getElementById('link').value = '';
    quantityInput.value = '1000';
    totalPrice.textContent = 'Rp0';
    selectedService = null;
    currentOrder = null;
    
    // Sembunyikan section pembayaran, tampilkan form order
    paymentSection.classList.add('hidden');
    orderSection.classList.remove('hidden');
    serviceDetails.classList.add('hidden');
  }
});