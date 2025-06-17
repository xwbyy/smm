document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const apiKeyInput = document.getElementById('apiKey');
  const saveKeyBtn = document.getElementById('saveKey');
  const tabItems = document.querySelectorAll('.menu-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const serviceSearch = document.getElementById('serviceSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const servicesList = document.getElementById('servicesList');
  const ordersList = document.getElementById('ordersList');
  const balanceInfo = document.getElementById('balanceInfo');
  const orderModal = document.getElementById('orderModal');
  const paymentModal = document.getElementById('paymentModal');
  const closeButtons = document.querySelectorAll('.close');
  const orderForm = document.getElementById('orderForm');
  
  // State
  let currentService = null;
  let currentOrder = null;
  let paymentCheckInterval = null;
  
  // Load saved API key
  const savedApiKey = localStorage.getItem('smmPanelApiKey');
  if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
    loadServices();
    loadOrders();
    loadBalance();
  }
  
  // Event Listeners
  saveKeyBtn.addEventListener('click', saveApiKey);
  
  tabItems.forEach(item => {
    item.addEventListener('click', switchTab);
  });
  
  serviceSearch.addEventListener('input', filterServices);
  categoryFilter.addEventListener('change', filterServices);
  
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      orderModal.style.display = 'none';
      paymentModal.style.display = 'none';
      clearPaymentCheck();
    });
  });
  
  orderForm.addEventListener('submit', createOrder);
  
  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === orderModal) {
      orderModal.style.display = 'none';
    }
    if (e.target === paymentModal) {
      paymentModal.style.display = 'none';
      clearPaymentCheck();
    }
  });
  
  // Functions
  function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      alert('API Key tidak boleh kosong');
      return;
    }
    
    localStorage.setItem('smmPanelApiKey', apiKey);
    alert('API Key berhasil disimpan');
    loadServices();
    loadOrders();
    loadBalance();
  }
  
  function switchTab(e) {
    const tabId = e.currentTarget.getAttribute('data-tab');
    
    tabItems.forEach(item => {
      item.classList.remove('active');
    });
    
    tabContents.forEach(content => {
      content.classList.remove('active');
    });
    
    e.currentTarget.classList.add('active');
    document.getElementById(tabId).classList.add('active');
    
    if (tabId === 'services') {
      loadServices();
    } else if (tabId === 'orders') {
      loadOrders();
    } else if (tabId === 'balance') {
      loadBalance();
    }
  }
  
  async function loadServices() {
    const apiKey = localStorage.getItem('smmPanelApiKey');
    if (!apiKey) return;
    
    servicesList.innerHTML = '<div class="loading">Memuat layanan...</div>';
    
    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key: apiKey })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        renderServices(data);
        updateCategoryFilter(data);
      } else {
        servicesList.innerHTML = `<div class="error">${data.error || 'Gagal memuat layanan'}</div>`;
      }
    } catch (error) {
      servicesList.innerHTML = `<div class="error">Terjadi kesalahan: ${error.message}</div>`;
    }
  }
  
  function renderServices(services) {
    if (!services || services.length === 0) {
      servicesList.innerHTML = '<div class="empty">Tidak ada layanan tersedia</div>';
      return;
    }
    
    servicesList.innerHTML = '';
    
    services.forEach(service => {
      const serviceCard = document.createElement('div');
      serviceCard.className = 'service-card';
      serviceCard.dataset.category = service.category;
      
      serviceCard.innerHTML = `
        <h3>${service.name}</h3>
        <div class="service-meta">
          <span class="service-type">${service.type}</span>
          <span class="service-category">${service.category}</span>
        </div>
        <div class="service-price">Rp${(parseFloat(service.rate) * 1.2).toFixed(2)} / 1000</div>
        <div class="service-limits">Min: ${service.min}, Max: ${service.max}</div>
        <button class="btn-order-service" data-id="${service.service}">Pesan Sekarang</button>
      `;
      
      servicesList.appendChild(serviceCard);
    });
    
    // Add event listeners to order buttons
    document.querySelectorAll('.btn-order-service').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const serviceId = e.currentTarget.getAttribute('data-id');
        currentService = services.find(s => s.service == serviceId);
        openOrderModal(currentService);
      });
    });
  }
  
  function updateCategoryFilter(services) {
    const categories = [...new Set(services.map(s => s.category))];
    categoryFilter.innerHTML = '<option value="">Semua Kategori</option>';
    
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
  }
  
  function filterServices() {
    const searchTerm = serviceSearch.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    
    document.querySelectorAll('.service-card').forEach(card => {
      const matchesSearch = card.textContent.toLowerCase().includes(searchTerm);
      const matchesCategory = !selectedCategory || card.dataset.category === selectedCategory;
      
      if (matchesSearch && matchesCategory) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  }
  
  function openOrderModal(service) {
    document.getElementById('serviceInfo').innerHTML = `
      <h3>${service.name}</h3>
      <p>${service.type} - ${service.category}</p>
      <p>Rate: Rp${service.rate} / 1000</p>
    `;
    
    document.getElementById('minQuantity').textContent = service.min;
    document.getElementById('maxQuantity').textContent = service.max;
    document.getElementById('quantity').min = service.min;
    document.getElementById('quantity').max = service.max;
    document.getElementById('quantity').value = service.min;
    document.getElementById('rate').textContent = `Rp${(parseFloat(service.rate) * 1.2}`;
    
    updateTotalPrice(service, service.min);
    
    orderModal.style.display = 'block';
  }
  
  function updateTotalPrice(service, quantity) {
    const rate = parseFloat(service.rate) * 1.2; // Apply 20% markup
    const totalPrice = Math.ceil((rate * quantity) / 1000);
    document.getElementById('totalPrice').textContent = `Rp${totalPrice}`;
  }
  
  // Quantity input event listener
  document.getElementById('quantity').addEventListener('input', function() {
    if (currentService) {
      const quantity = parseInt(this.value) || 0;
      updateTotalPrice(currentService, quantity);
    }
  });
  
  async function createOrder(e) {
    e.preventDefault();
    
    const apiKey = localStorage.getItem('smmPanelApiKey');
    if (!apiKey) {
      alert('Silakan masukkan API Key terlebih dahulu');
      return;
    }
    
    const link = document.getElementById('targetLink').value;
    const quantity = document.getElementById('quantity').value;
    
    if (!link || !quantity) {
      alert('Silakan lengkapi semua field');
      return;
    }
    
    try {
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          serviceId: currentService.service,
          link: link,
          quantity: quantity,
          key: apiKey
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        currentOrder = data.order;
        openPaymentModal(data.payment, data.order);
        orderModal.style.display = 'none';
      } else {
        alert(data.error || 'Gagal membuat pesanan');
      }
    } catch (error) {
      alert(`Terjadi kesalahan: ${error.message}`);
    }
  }
  
  function openPaymentModal(payment, order) {
    document.getElementById('paymentAmount').textContent = `Rp${order.amount}`;
    document.getElementById('paymentId').textContent = payment.reffId;
    document.getElementById('paymentExpiry').textContent = payment.expiredAt;
    document.getElementById('qrImage').src = payment.qrImage;
    document.getElementById('qrString').textContent = payment.qrString;
    
    paymentModal.style.display = 'block';
    
    // Start checking payment status
    startPaymentCheck(payment.reffId, order);
  }
  
  function startPaymentCheck(paymentId, order) {
    // Clear any existing interval
    clearPaymentCheck();
    
    // Initial check
    checkPaymentStatus(paymentId, order);
    
    // Set up interval for checking every 10 seconds
    paymentCheckInterval = setInterval(() => {
      checkPaymentStatus(paymentId, order);
    }, 10000);
    
    // Update progress bar
    const progressBar = document.getElementById('paymentProgress');
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 1;
      progressBar.style.width = `${progress}%`;
      
      if (progress >= 100) {
        clearInterval(progressInterval);
      }
    }, 600); // 60 seconds total for 100% (matches payment expiry)
  }
  
  function clearPaymentCheck() {
    if (paymentCheckInterval) {
      clearInterval(paymentCheckInterval);
      paymentCheckInterval = null;
    }
  }
  
  async function checkPaymentStatus(paymentId, order) {
    try {
      const response = await fetch('/api/check-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: paymentId,
          orderData: order
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        document.getElementById('paymentStatus').textContent = 'Pembayaran berhasil! Pesanan sedang diproses.';
        document.getElementById('paymentStatus').style.color = 'var(--success-color)';
        document.getElementById('checkPayment').style.display = 'none';
        clearPaymentCheck();
        
        // Add to orders list
        loadOrders();
      } else if (data.status === 'pending') {
        document.getElementById('paymentStatus').textContent = 'Menunggu pembayaran...';
        document.getElementById('paymentStatus').style.color = 'var(--warning-color)';
      } else {
        document.getElementById('paymentStatus').textContent = data.message || 'Pembayaran gagal atau kadaluarsa';
        document.getElementById('paymentStatus').style.color = 'var(--danger-color)';
        clearPaymentCheck();
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    }
  }
  
  // Manual check payment button
  document.getElementById('checkPayment').addEventListener('click', function() {
    if (currentOrder) {
      checkPaymentStatus(currentOrder.reffId, currentOrder);
    }
  });
  
  async function loadOrders() {
    const apiKey = localStorage.getItem('smmPanelApiKey');
    if (!apiKey) return;
    
    ordersList.innerHTML = '<div class="loading">Memuat pesanan...</div>';
    
    try {
      // In a real app, you would fetch orders from your backend
      // For this demo, we'll just show a message
      ordersList.innerHTML = `
        <div class="order-item">
          <div class="order-info">
            <div class="order-id">ID: ${currentOrder?.reffId || 'N/A'}</div>
            <div class="order-service">Layanan: ${currentService?.name || 'N/A'}</div>
          </div>
          <div class="order-status status-pending">Pending</div>
        </div>
      `;
    } catch (error) {
      ordersList.innerHTML = `<div class="error">Terjadi kesalahan: ${error.message}</div>`;
    }
  }
  
  async function loadBalance() {
    const apiKey = localStorage.getItem('smmPanelApiKey');
    if (!apiKey) return;
    
    balanceInfo.innerHTML = '<div class="loading">Memuat saldo...</div>';
    
    try {
      const response = await fetch('/api/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key: apiKey })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        balanceInfo.innerHTML = `
          <div class="balance-amount">${data.balance} ${data.currency}</div>
          <div class="balance-currency">Saldo tersedia</div>
        `;
      } else {
        balanceInfo.innerHTML = `<div class="error">${data.error || 'Gagal memuat saldo'}</div>`;
      }
    } catch (error) {
      balanceInfo.innerHTML = `<div class="error">Terjadi kesalahan: ${error.message}</div>`;
    }
  }
});