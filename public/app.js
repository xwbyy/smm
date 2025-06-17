document.addEventListener('DOMContentLoaded', function() {
  // Tab switching functionality
  const tabs = document.querySelectorAll('nav li');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      
      // Load data when switching to specific tabs
      if (tabId === 'services') {
        loadServices();
      } else if (tabId === 'orders') {
        loadOrders();
      } else if (tabId === 'new-order') {
        populateServiceDropdown();
      }
    });
  });
  
  // API key is fixed
  const API_KEY = '4e59a83d29629d875f9eaa48134d630d';
  
  // Initial data loading
  loadBalance();
  loadServices();
  loadOrders();
  populateServiceDropdown();
  
  // Refresh balance button
  document.getElementById('refresh-balance').addEventListener('click', loadBalance);
  
  // Refresh orders button
  document.getElementById('refresh-orders').addEventListener('click', loadOrders);
  
  // Modal functionality
  const modal = document.getElementById('order-modal');
  const closeModal = document.querySelector('.close-modal');
  
  closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  // Service search functionality
  const serviceSearch = document.getElementById('service-search');
  serviceSearch.addEventListener('input', filterServices);
  
  // Category filter functionality
  const categoryFilter = document.getElementById('category-filter');
  categoryFilter.addEventListener('change', filterServices);
  
  // Order status filter functionality
  const orderStatusFilter = document.getElementById('order-status-filter');
  orderStatusFilter.addEventListener('change', filterOrders);
  
  // New order form functionality
  const orderForm = document.getElementById('order-form');
  const serviceSelect = document.getElementById('service-select');
  const serviceQuantity = document.getElementById('service-quantity');
  
  orderForm.addEventListener('submit', placeOrder);
  serviceSelect.addEventListener('change', updateQuantityRange);
  serviceQuantity.addEventListener('input', calculateEstimatedPrice);
  
  // Deposit functionality
  document.getElementById('create-deposit').addEventListener('click', createDeposit);
  document.getElementById('check-payment').addEventListener('click', checkPaymentStatus);
  
  // Functions
  function showError(message) {
    alert('Error: ' + message);
  }
  
  function loadBalance() {
    fetch('/api/balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: API_KEY })
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        showError(data.error);
      } else {
        document.getElementById('balance-amount').textContent = 
          `Rp${parseInt(data.balance).toLocaleString('id-ID')}`;
      }
    })
    .catch(error => {
      showError(error.message);
    });
  }
  
  function loadServices() {
    const servicesList = document.getElementById('services-list');
    servicesList.innerHTML = '<div class="loading">Memuat layanan...</div>';
    
    fetch('/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: API_KEY })
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        showError(data.error);
        servicesList.innerHTML = `<div class="error">${data.error}</div>`;
      } else {
        renderServices(data);
        populateCategoryFilter(data);
      }
    })
    .catch(error => {
      showError(error.message);
      servicesList.innerHTML = `<div class="error">${error.message}</div>`;
    });
  }
  
  function renderServices(services) {
    const servicesList = document.getElementById('services-list');
    
    if (services.length === 0) {
      servicesList.innerHTML = '<div class="no-results">Tidak ada layanan ditemukan</div>';
      return;
    }
    
    let html = '';
    
    services.forEach(service => {
      html += `
        <div class="service-card" data-category="${service.category}">
          <h3>${service.name}</h3>
          <div class="service-meta">
            <span class="service-type">${service.type}</span>
            <span class="service-price">Rp${(service.rate * 1000).toLocaleString('id-ID')} per 1000</span>
          </div>
          <div class="service-minmax">Min: ${service.min} - Maks: ${service.max}</div>
          <div class="service-desc">${service.description || 'Tidak ada deskripsi'}</div>
          <div class="service-actions">
            <button class="order-btn" data-service-id="${service.service}" 
              data-rate="${service.rate}" data-min="${service.min}" data-max="${service.max}">
              Pesan Sekarang
            </button>
          </div>
        </div>
      `;
    });
    
    servicesList.innerHTML = html;
    
    // Add event listeners to order buttons
    document.querySelectorAll('.order-btn').forEach(button => {
      button.addEventListener('click', function() {
        const serviceId = this.getAttribute('data-service-id');
        const rate = this.getAttribute('data-rate');
        const min = this.getAttribute('data-min');
        const max = this.getAttribute('data-max');
        
        // Switch to new order tab
        document.querySelector('nav li[data-tab="new-order"]').click();
        
        // Set the service in the dropdown
        const serviceSelect = document.getElementById('service-select');
        serviceSelect.value = serviceId;
        
        // Update the quantity range
        document.getElementById('quantity-range').textContent = `Min: ${min} - Maks: ${max}`;
        document.getElementById('service-quantity').min = min;
        document.getElementById('service-quantity').max = max;
        document.getElementById('service-quantity').value = min;
        
        // Calculate initial price
        calculateEstimatedPrice();
      });
    });
  }
  
  function populateCategoryFilter(services) {
    const categoryFilter = document.getElementById('category-filter');
    const categories = new Set();
    
    // Add default option
    categoryFilter.innerHTML = '<option value="">Semua Kategori</option>';
    
    // Collect unique categories
    services.forEach(service => {
      categories.add(service.category);
    });
    
    // Add category options
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
  }
  
  function filterServices() {
    const searchTerm = document.getElementById('service-search').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    const serviceCards = document.querySelectorAll('.service-card');
    
    serviceCards.forEach(card => {
      const serviceName = card.querySelector('h3').textContent.toLowerCase();
      const serviceCategory = card.getAttribute('data-category');
      
      const matchesSearch = serviceName.includes(searchTerm);
      const matchesCategory = category === '' || serviceCategory === category;
      
      if (matchesSearch && matchesCategory) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  }
  
  function loadOrders() {
    const ordersList = document.getElementById('orders-list');
    ordersList.innerHTML = '<div class="loading">Memuat pesanan...</div>';
    
    // In a real app, you would fetch actual orders from the API
    // For now, we'll simulate it with a timeout
    setTimeout(() => {
      ordersList.innerHTML = `
        <div class="order-card">
          <div class="order-info">
            <h3>Instagram Followers</h3>
            <div class="order-meta">
              <span>Pesanan #23501</span>
              <span>Jumlah: 1000</span>
              <span>Harga: Rp900</span>
            </div>
            <div class="order-status status-in-progress">Dalam Proses</div>
          </div>
          <div class="order-actions">
            <button class="action-btn details-btn">Detail</button>
          </div>
        </div>
      `;
      
      // Add event listeners to order action buttons
      document.querySelectorAll('.details-btn').forEach(button => {
        button.addEventListener('click', showOrderDetails);
      });
    }, 1000);
  }
  
  function filterOrders() {
    const statusFilter = document.getElementById('order-status-filter').value;
    const orderCards = document.querySelectorAll('.order-card');
    
    orderCards.forEach(card => {
      const statusElement = card.querySelector('.order-status');
      if (!statusElement) return;
      
      const status = statusElement.textContent;
      
      if (statusFilter === 'all' || status === statusFilter) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }
  
  function showOrderDetails() {
    const modal = document.getElementById('order-modal');
    const orderDetails = document.getElementById('order-details');
    
    // In a real app, you would fetch actual order details from the API
    orderDetails.innerHTML = `
      <div class="order-detail">
        <h4>Informasi Pesanan</h4>
        <p><strong>Layanan:</strong> Instagram Followers</p>
        <p><strong>ID Pesanan:</strong> 23501</p>
        <p><strong>Link:</strong> https://instagram.com/username</p>
        <p><strong>Jumlah:</strong> 1000</p>
        <p><strong>Harga:</strong> Rp900</p>
        <p><strong>Status:</strong> Dalam Proses</p>
        <p><strong>Jumlah Mulai:</strong> 3572</p>
        <p><strong>Sisa:</strong> 157</p>
      </div>
    `;
    
    modal.style.display = 'flex';
  }
  
  function populateServiceDropdown() {
    const serviceSelect = document.getElementById('service-select');
    serviceSelect.innerHTML = '<option value="">Pilih layanan</option>';
    
    fetch('/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: API_KEY })
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        showError(data.error);
      } else {
        data.forEach(service => {
          const option = document.createElement('option');
          option.value = service.service;
          option.textContent = `${service.name} (Rp${(service.rate * 1000).toLocaleString('id-ID')} per 1000)`;
          option.setAttribute('data-rate', service.rate);
          option.setAttribute('data-min', service.min);
          option.setAttribute('data-max', service.max);
          serviceSelect.appendChild(option);
        });
      }
    })
    .catch(error => {
      showError(error.message);
    });
  }
  
  function updateQuantityRange() {
    const selectedOption = this.options[this.selectedIndex];
    if (!selectedOption.value) return;
    
    const min = selectedOption.getAttribute('data-min');
    const max = selectedOption.getAttribute('data-max');
    
    document.getElementById('quantity-range').textContent = `Min: ${min} - Maks: ${max}`;
    document.getElementById('service-quantity').min = min;
    document.getElementById('service-quantity').max = max;
    document.getElementById('service-quantity').value = min;
    
    calculateEstimatedPrice();
  }
  
  function calculateEstimatedPrice() {
    const selectedOption = document.getElementById('service-select').options[
      document.getElementById('service-select').selectedIndex
    ];
    
    if (!selectedOption || !selectedOption.value) {
      document.getElementById('estimated-price').textContent = 'Rp0';
      return;
    }
    
    const rate = parseFloat(selectedOption.getAttribute('data-rate'));
    const quantity = parseInt(document.getElementById('service-quantity').value) || 0;
    
    const price = (rate * quantity).toFixed(0);
    document.getElementById('estimated-price').textContent = `Rp${price.toLocaleString('id-ID')}`;
  }
  
  function placeOrder(e) {
    e.preventDefault();
    
    const serviceId = document.getElementById('service-select').value;
    const link = document.getElementById('service-link').value;
    const quantity = document.getElementById('service-quantity').value;
    const runs = document.getElementById('service-runs').value;
    const interval = document.getElementById('service-interval').value;
    const estimatedPrice = document.getElementById('estimated-price').textContent.replace(/[^\d]/g, '');
    
    if (!serviceId || !link || !quantity) {
      showError('Harap isi semua field yang diperlukan');
      return;
    }
    
    // Check if balance is sufficient
    const balanceText = document.getElementById('balance-amount').textContent;
    const currentBalance = parseInt(balanceText.replace(/[^\d]/g, '') || 0;
    
    if (currentBalance < parseInt(estimatedPrice)) {
      const confirmDeposit = confirm('Saldo Anda tidak mencukupi. Apakah Anda ingin melakukan deposit sekarang?');
      if (confirmDeposit) {
        document.querySelector('nav li[data-tab="deposit"]').click();
        document.getElementById('deposit-amount').value = Math.max(10000, parseInt(estimatedPrice) - currentBalance + 10000);
      }
      return;
    }
    
    const orderData = {
      key: API_KEY,
      action: 'add',
      service: serviceId,
      link: link,
      quantity: quantity
    };
    
    if (runs) orderData.runs = runs;
    if (interval) orderData.interval = interval;
    
    fetch('/api/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        showError(data.error);
      } else {
        alert(`Pesanan berhasil dibuat! ID Pesanan: ${data.order}`);
        // Reset form
        document.getElementById('order-form').reset();
        document.getElementById('estimated-price').textContent = 'Rp0';
        // Switch to orders tab
        document.querySelector('nav li[data-tab="orders"]').click();
        // Refresh orders list and balance
        loadOrders();
        loadBalance();
      }
    })
    .catch(error => {
      showError(error.message);
    });
  }
  
  function createDeposit() {
    const amount = parseInt(document.getElementById('deposit-amount').value);
    
    if (!amount || amount < 10000) {
      showError('Jumlah minimal deposit adalah Rp10,000');
      return;
    }
    
    fetch('/api/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: amount })
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        showError(data.error);
      } else {
        const paymentInfo = data.data;
        
        // Show QR code
        const qrContainer = document.getElementById('qr-code-container');
        qrContainer.innerHTML = `<img src="data:image/png;base64,${paymentInfo.qr_image}" alt="QR Code">`;
        
        // Show payment details
        const paymentDetails = document.getElementById('payment-details');
        paymentDetails.innerHTML = `
          <p><strong>ID Transaksi:</strong> ${paymentInfo.reff_id}</p>
          <p><strong>Jumlah Deposit:</strong> Rp${paymentInfo.nominal.toLocaleString('id-ID')}</p>
          <p><strong>Biaya Admin:</strong> Rp${paymentInfo.fee.toLocaleString('id-ID')}</p>
          <p><strong>Saldo Diterima:</strong> Rp${paymentInfo.get_balance.toLocaleString('id-ID')}</p>
          <p><strong>Batas Waktu:</strong> ${paymentInfo.expired_at}</p>
          <p><strong>QR String:</strong> ${paymentInfo.qr_string}</p>
        `;
        
        // Store transaction ID for checking status
        document.getElementById('payment-info').setAttribute('data-trxid', paymentInfo.id);
        
        // Show payment info section
        document.getElementById('payment-info').style.display = 'block';
        
        // Start checking payment status periodically
        localStorage.setItem('lastDepositTrxId', paymentInfo.id);
        localStorage.setItem('lastDepositAmount', paymentInfo.get_balance);
      }
    })
    .catch(error => {
      showError(error.message);
    });
  }
  
  function checkPaymentStatus() {
    const trxid = document.getElementById('payment-info').getAttribute('data-trxid');
    if (!trxid) return;
    
    fetch(`/api/payment/status/${trxid}`)
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          showError(data.error);
        } else {
          if (data.data.status === 'success') {
            alert('Pembayaran berhasil! Saldo Anda akan diperbarui.');
            loadBalance();
          } else {
            alert('Pembayaran belum diterima. Silakan coba lagi nanti.');
          }
        }
      })
      .catch(error => {
        showError(error.message);
      });
  }
  
  // Check for pending deposit on page load
  function checkPendingDeposit() {
    const lastTrxId = localStorage.getItem('lastDepositTrxId');
    if (lastTrxId) {
      fetch(`/api/payment/status/${lastTrxId}`)
        .then(response => response.json())
        .then(data => {
          if (data.success && data.data.status === 'success') {
            const depositAmount = localStorage.getItem('lastDepositAmount');
            alert(`Deposit sebesar Rp${parseInt(depositAmount).toLocaleString('id-ID')} telah berhasil!`);
            loadBalance();
          }
          localStorage.removeItem('lastDepositTrxId');
          localStorage.removeItem('lastDepositAmount');
        })
        .catch(() => {
          localStorage.removeItem('lastDepositTrxId');
          localStorage.removeItem('lastDepositAmount');
        });
    }
  }
  
  // Run pending deposit check on load
  checkPendingDeposit();
});