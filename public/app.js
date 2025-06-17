document.addEventListener('DOMContentLoaded', function() {
  // Elemen DOM
  const serviceSelect = document.getElementById('service-select');
  const serviceDetails = document.getElementById('service-details');
  const orderForm = document.getElementById('order-form');
  const quantityInput = document.getElementById('quantity');
  const minQuantitySpan = document.getElementById('min-quantity');
  const maxQuantitySpan = document.getElementById('max-quantity');
  const totalInput = document.getElementById('total');
  const paymentModal = document.getElementById('payment-modal');
  const closeModal = document.querySelector('.close');
  
  // Variabel state
  let services = [];
  let selectedService = null;
  let currentOrder = null;
  
  // Fungsi untuk memuat daftar layanan
  async function loadServices() {
    try {
      const response = await fetch('/api/services');
      if (!response.ok) throw new Error('Gagal memuat layanan');
      
      services = await response.json();
      populateServiceSelect(services);
    } catch (error) {
      console.error('Error:', error);
      alert('Gagal memuat daftar layanan. Silakan refresh halaman.');
    }
  }
  
  // Fungsi untuk mengisi dropdown layanan
  function populateServiceSelect(services) {
    serviceSelect.innerHTML = '<option value="">-- Pilih Layanan --</option>';
    
    services.forEach(service => {
      const option = document.createElement('option');
      option.value = service.service;
      option.textContent = `${service.name} (Rp${(service.rate * 1000).toLocaleString()}/1000)`;
      serviceSelect.appendChild(option);
    });
  }
  
  // Event listener untuk perubahan pilihan layanan
  serviceSelect.addEventListener('change', function() {
    const serviceId = parseInt(this.value);
    selectedService = services.find(s => s.service === serviceId);
    
    if (selectedService) {
      updateServiceDetails(selectedService);
      updateQuantityConstraints(selectedService);
      serviceDetails.classList.remove('hidden');
    } else {
      serviceDetails.classList.add('hidden');
    }
    
    calculateTotal();
  });
  
  // Fungsi untuk memperbarui detail layanan
  function updateServiceDetails(service) {
    document.getElementById('service-name').textContent = service.name;
    document.getElementById('service-category').textContent = service.category;
    document.getElementById('service-rate').textContent = `Rp${(service.rate * 1000).toLocaleString()}/1000`;
    document.getElementById('service-min').textContent = service.min;
    document.getElementById('service-max').textContent = service.max;
    document.getElementById('service-refill').textContent = service.refill ? 'Ya' : 'Tidak';
  }
  
  // Fungsi untuk memperbarui batasan kuantitas
  function updateQuantityConstraints(service) {
    quantityInput.min = service.min;
    quantityInput.max = service.max;
    minQuantitySpan.textContent = service.min;
    maxQuantitySpan.textContent = service.max;
  }
  
  // Event listener untuk perubahan kuantitas
  quantityInput.addEventListener('input', calculateTotal);
  
  // Fungsi untuk menghitung total harga
  function calculateTotal() {
    if (!selectedService) {
      totalInput.value = 'Rp0';
      return;
    }
    
    const quantity = parseInt(quantityInput.value) || 0;
    const rate = parseFloat(selectedService.rate);
    const total = (rate * quantity * 1000).toFixed(0); // Konversi ke Rupiah
    
    totalInput.value = `Rp${parseInt(total).toLocaleString()}`;
  }
  
  // Event listener untuk submit form
  orderForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!selectedService) {
      alert('Silakan pilih layanan terlebih dahulu');
      return;
    }
    
    const link = document.getElementById('link').value;
    const quantity = parseInt(quantityInput.value);
    
    if (quantity < selectedService.min || quantity > selectedService.max) {
      alert(`Jumlah harus antara ${selectedService.min} dan ${selectedService.max}`);
      return;
    }
    
    try {
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
      
      if (!response.ok) throw new Error('Gagal membuat pesanan');
      
      const orderData = await response.json();
      currentOrder = orderData;
      showPaymentModal(orderData);
    } catch (error) {
      console.error('Error:', error);
      alert('Gagal membuat pesanan. Silakan coba lagi.');
    }
  });
  
  // Fungsi untuk menampilkan modal pembayaran
  function showPaymentModal(orderData) {
    document.getElementById('qr-code-image').src = orderData.payment.qrImageUrl;
    document.getElementById('transaction-id').textContent = orderData.payment.transactionId;
    document.getElementById('payment-amount').textContent = `Rp${orderData.payment.amount.toLocaleString()}`;
    document.getElementById('expiry-time').textContent = orderData.payment.expiredAt;
    
    paymentModal.classList.remove('hidden');
  }
  
  // Event listener untuk menutup modal
  closeModal.addEventListener('click', function() {
    paymentModal.classList.add('hidden');
  });
  
  // Event listener untuk klik di luar modal
  window.addEventListener('click', function(e) {
    if (e.target === paymentModal) {
      paymentModal.classList.add('hidden');
    }
  });
  
  // Memuat daftar layanan saat halaman dimuat
  loadServices();
});