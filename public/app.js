document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const serviceSearch = document.getElementById('service-search');
  const serviceCategory = document.getElementById('service-category');
  const serviceSort = document.getElementById('service-sort');
  const serviceGrid = document.getElementById('service-grid');
  const orderSection = document.getElementById('order-section');
  const paymentSection = document.getElementById('payment-section');
  const statusSection = document.getElementById('status-section');
  const orderDetails = document.getElementById('order-details');
  const orderForm = document.getElementById('order-form');
  const orderLink = document.getElementById('order-link');
  const orderQuantity = document.getElementById('order-quantity');
  const quantityRange = document.getElementById('quantity-range');
  const ratePerK = document.getElementById('rate-per-k');
  const totalPrice = document.getElementById('total-price');
  const submitOrder = document.getElementById('submit-order');
  const backToServices = document.getElementById('back-to-services');
  const backToOrder = document.getElementById('back-to-order');
  const backToPayment = document.getElementById('back-to-payment');
  
  // State
  let services = [];
  let categories = [];
  let selectedService = null;
  let currentOrder = null;
  
  // Initialize
  loadServices();
  
  // Event Listeners
  serviceSearch.addEventListener('input', filterServices);
  serviceCategory.addEventListener('change', filterServices);
  serviceSort.addEventListener('change', filterServices);
  orderQuantity.addEventListener('input', calculatePrice);
  orderForm.addEventListener('submit', createOrder);
  backToServices.addEventListener('click', showServicesSection);
  backToOrder.addEventListener('click', showOrderSection);
  backToPayment.addEventListener('click', showPaymentSection);
  
  // Load Services
  function loadServices() {
    serviceGrid.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Memuat layanan...</div>';
    
    fetch('/api/services')
      .then(response => response.json())
      .then(data => {
        services = data;
        loadCategories();
        filterServices();
      })
      .catch(error => {
        console.error('Error loading services:', error);
        serviceGrid.innerHTML = '<div class="error">Gagal memuat layanan. Silakan refresh halaman.</div>';
      });
  }
  
  // Load Categories
  function loadCategories() {
    categories = [...new Set(services.map(service => service.category))];
    renderCategories();
  }
  
  // Render Categories
  function renderCategories() {
    serviceCategory.innerHTML = '<option value="">Semua Kategori</option>';
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      serviceCategory.appendChild(option);
    });
  }
  
  // Filter Services
  function filterServices() {
    const searchTerm = serviceSearch.value.toLowerCase();
    const category = serviceCategory.value;
    const sortBy = serviceSort.value;
    
    let filtered = [...services];
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(service => 
        service.name.toLowerCase().includes(searchTerm) || 
        service.category.toLowerCase().includes(searchTerm)
      );
    }
    
    // Filter by category
    if (category) {
      filtered = filtered.filter(service => service.category === category);
    }
    
    // Sort services
    switch (sortBy) {
      case 'name-asc':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'price-asc':
        filtered.sort((a, b) => a.rate - b.rate);
        break;
      case 'price-desc':
        filtered.sort((a, b) => b.rate - a.rate);
        break;
    }
    
    renderServices(filtered);
  }
  
  // Render Services
  function renderServices(servicesToRender) {
    if (servicesToRender.length === 0) {
      serviceGrid.innerHTML = '<div class="no-results">Tidak ada layanan yang ditemukan</div>';
      return;
    }
    
    serviceGrid.innerHTML = '';
    servicesToRender.forEach(service => {
      const card = document.createElement('div');
      card.className = 'service-card';
      card.innerHTML = `
        <div class="service-category">${service.category}</div>
        <h3>${service.name}</h3>
        <div class="service-price">
          Rp${(service.rate * 1000).toLocaleString('id-ID')} <small>/ ${service.min}-${service.max}</small>
        </div>
        <p>${service.type}</p>
        <div class="service-meta">
          <span><i class="fas fa-${service.refill ? 'check' : 'times'}"></i> ${service.refill ? 'Refill' : 'No Refill'}</span>
          <span><i class="fas fa-${service.cancel ? 'check' : 'times'}"></i> ${service.cancel ? 'Cancel' : 'No Cancel'}</span>
        </div>
      `;
      
      card.addEventListener('click', () => selectService(service));
      serviceGrid.appendChild(card);
    });
  }
  
  // Select Service
  function selectService(service) {
    selectedService = service;
    
    // Update order details
    orderDetails.innerHTML = `
      <h3>${service.name}</h3>
      <p><strong>Kategori:</strong> ${service.category}</p>
      <p><strong>Harga:</strong> Rp${(service.rate * 1000).toLocaleString('id-ID')} per 1000</p>
      <p><strong>Min:</strong> ${service.min} | <strong>Max:</strong> ${service.max}</p>
      <p><strong>Refill:</strong> ${service.refill ? 'Ya' : 'Tidak'} | <strong>Cancel:</strong> ${service.cancel ? 'Ya' : 'Tidak'}</p>
    `;
    
    // Set quantity range
    orderQuantity.min = service.min;
    orderQuantity.max = service.max;
    orderQuantity.value = service.min;
    quantityRange.textContent = `(Min: ${service.min}, Max: ${service.max})`;
    
    // Calculate initial price
    calculatePrice();
    
    // Show order section
    showOrderSection();
  }
  
  // Calculate Price
  function calculatePrice() {
    if (!selectedService) return;
    
    const quantity = parseInt(orderQuantity.value) || 0;
    const rate = selectedService.rate;
    const price = (rate * quantity).toFixed(2);
    
    ratePerK.textContent = `Rp${(rate * 1000).toLocaleString('id-ID')}`;
    totalPrice.textContent = `Rp${(price * 1000).toLocaleString('id-ID')}`;
  }
  
  // Create Order
  function createOrder(e) {
    e.preventDefault();
    
    if (!selectedService) return;
    
    const link = orderLink.value;
    const quantity = orderQuantity.value;
    
    if (!link || !quantity) {
      alert('Harap isi semua field!');
      return;
    }
    
    submitOrder.disabled = true;
    submitOrder.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    
    fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        serviceId: selectedService.service,
        link,
        quantity
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        currentOrder = {
          id: data.orderId,
          serviceName: data.serviceName,
          amount: data.amount,
          link,
          quantity
        };
        
        initPaymentProcess(data.amount);
      } else {
        alert('Gagal membuat pesanan: ' + (data.error || 'Unknown error'));
      }
    })
    .catch(error => {
      console.error('Error creating order:', error);
      alert('Terjadi kesalahan saat membuat pesanan');
    })
    .finally(() => {
      submitOrder.disabled = false;
      submitOrder.innerHTML = '<i class="fas fa-paper-plane"></i> Lanjutkan Pembayaran';
    });
  }
  
  // Show Sections
  function showServicesSection() {
    document.getElementById('services-section').classList.remove('hidden');
    orderSection.classList.add('hidden');
    paymentSection.classList.add('hidden');
    statusSection.classList.add('hidden');
  }
  
  function showOrderSection() {
    document.getElementById('services-section').classList.add('hidden');
    orderSection.classList.remove('hidden');
    paymentSection.classList.add('hidden');
    statusSection.classList.add('hidden');
  }
  
  function showPaymentSection() {
    document.getElementById('services-section').classList.add('hidden');
    orderSection.classList.add('hidden');
    paymentSection.classList.remove('hidden');
    statusSection.classList.add('hidden');
  }
  
  function showStatusSection() {
    document.getElementById('services-section').classList.add('hidden');
    orderSection.classList.add('hidden');
    paymentSection.classList.add('hidden');
    statusSection.classList.remove('hidden');
  }
});

// Format Rupiah
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}