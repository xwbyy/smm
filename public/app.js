document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const searchInput = document.getElementById('search-service');
  const categoryList = document.getElementById('category-list');
  const categoryFilter = document.getElementById('category-filter');
  const sortBy = document.getElementById('sort-by');
  const serviceGrid = document.getElementById('service-grid');
  const orderSection = document.getElementById('order-section');
  const paymentSection = document.getElementById('payment-section');
  const orderDetails = document.getElementById('order-details');
  const orderForm = document.getElementById('order-form');
  const quantityInput = document.getElementById('quantity');
  const quantityRange = document.getElementById('quantity-range');
  const ratePerK = document.getElementById('rate-per-k');
  const totalPrice = document.getElementById('total-price');
  const orderBtn = document.getElementById('order-btn');
  
  // State
  let services = [];
  let categories = [];
  let selectedService = null;
  let currentOrder = null;
  
  // Init
  loadCategories();
  loadServices();
  
  // Event Listeners
  searchInput.addEventListener('input', filterServices);
  categoryFilter.addEventListener('change', filterServices);
  sortBy.addEventListener('change', filterServices);
  quantityInput.addEventListener('input', calculatePrice);
  orderForm.addEventListener('submit', createOrder);
  
  // Load Categories
  function loadCategories() {
    categoryList.innerHTML = '<li class="loading">Memuat kategori...</li>';
    
    fetch('/api/categories')
      .then(response => response.json())
      .then(data => {
        categories = data;
        renderCategories();
      })
      .catch(error => {
        console.error('Error loading categories:', error);
        categoryList.innerHTML = '<li>Gagal memuat kategori</li>';
      });
  }
  
  // Render Categories
  function renderCategories() {
    categoryList.innerHTML = '';
    
    // Add "All" category
    const allItem = document.createElement('li');
    allItem.textContent = 'Semua Kategori';
    allItem.classList.add('active');
    allItem.addEventListener('click', () => {
      document.querySelectorAll('#category-list li').forEach(li => li.classList.remove('active'));
      allItem.classList.add('active');
      categoryFilter.value = '';
      filterServices();
    });
    categoryList.appendChild(allItem);
    
    // Add other categories
    categories.forEach(category => {
      const item = document.createElement('li');
      item.textContent = category;
      item.addEventListener('click', () => {
        document.querySelectorAll('#category-list li').forEach(li => li.classList.remove('active'));
        item.classList.add('active');
        categoryFilter.value = category;
        filterServices();
      });
      categoryList.appendChild(item);
    });
    
    // Also populate category filter dropdown
    categoryFilter.innerHTML = '<option value="">Semua Kategori</option>';
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
  }
  
  // Load Services
  function loadServices() {
    serviceGrid.innerHTML = '<div class="loading-service"><i class="fas fa-spinner fa-spin"></i> Memuat layanan...</div>';
    
    fetch('/api/services')
      .then(response => response.json())
      .then(data => {
        services = data;
        renderServices(services);
      })
      .catch(error => {
        console.error('Error loading services:', error);
        serviceGrid.innerHTML = '<div class="error">Gagal memuat layanan. Silakan refresh halaman.</div>';
      });
  }
  
  // Render Services
  function renderServices(servicesToRender) {
    serviceGrid.innerHTML = '';
    
    if (servicesToRender.length === 0) {
      serviceGrid.innerHTML = '<div class="no-results">Tidak ada layanan yang ditemukan</div>';
      return;
    }
    
    servicesToRender.forEach(service => {
      const serviceCard = document.createElement('div');
      serviceCard.className = 'service-card';
      serviceCard.innerHTML = `
        <div class="service-category">${service.category}</div>
        <h3>${service.name}</h3>
        <div class="service-price">
          Rp${(service.rate * 1000).toLocaleString('id-ID')} <small>/ ${service.min}-${service.max}</small>
        </div>
        <p>${service.type}</p>
        <div class="service-meta">
          <span><i class="fas fa-${service.refill ? 'check-circle' : 'times-circle'}"></i> ${service.refill ? 'Refill' : 'No Refill'}</span>
          <span><i class="fas fa-${service.cancel ? 'check-circle' : 'times-circle'}"></i> ${service.cancel ? 'Cancel' : 'No Cancel'}</span>
        </div>
      `;
      
      serviceCard.addEventListener('click', () => selectService(service));
      serviceGrid.appendChild(serviceCard);
    });
  }
  
  // Filter Services
  function filterServices() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    const sortOption = sortBy.value;
    
    let filteredServices = [...services];
    
    // Filter by search term
    if (searchTerm) {
      filteredServices = filteredServices.filter(service => 
        service.name.toLowerCase().includes(searchTerm) || 
        service.category.toLowerCase().includes(searchTerm)
      );
    }
    
    // Filter by category
    if (selectedCategory) {
      filteredServices = filteredServices.filter(service => 
        service.category === selectedCategory
      );
    }
    
    // Sort services
    switch (sortOption) {
      case 'name':
        filteredServices.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price-asc':
        filteredServices.sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
        break;
      case 'price-desc':
        filteredServices.sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate));
        break;
    }
    
    renderServices(filteredServices);
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
    quantityInput.min = service.min;
    quantityInput.max = service.max;
    quantityInput.value = service.min;
    quantityRange.textContent = `(Min: ${service.min}, Max: ${service.max})`;
    
    // Calculate initial price
    calculatePrice();
    
    // Show order section
    orderSection.classList.remove('hidden');
    paymentSection.classList.add('hidden');
    
    // Scroll to order section
    orderSection.scrollIntoView({ behavior: 'smooth' });
  }
  
  // Calculate Price
  function calculatePrice() {
    if (!selectedService) return;
    
    const quantity = parseInt(quantityInput.value) || 0;
    const rate = parseFloat(selectedService.rate);
    const price = (rate * quantity).toFixed(2);
    
    ratePerK.textContent = `Rp${(rate * 1000).toLocaleString('id-ID')}`;
    totalPrice.textContent = `Rp${(price * 1000).toLocaleString('id-ID')}`;
  }
  
  // Create Order
  function createOrder(e) {
    e.preventDefault();
    
    if (!selectedService) return;
    
    const link = document.getElementById('link').value;
    const quantity = quantityInput.value;
    
    if (!link || !quantity) {
      alert('Harap isi semua field!');
      return;
    }
    
    orderBtn.disabled = true;
    orderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    
    fetch('/api/order', {
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
          orderId: data.orderId,
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
      orderBtn.disabled = false;
      orderBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Buat Pesanan';
    });
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