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
      tab.classList.add('active'));
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active'));
      
      // Load data when switching to specific tabs
      if (tabId === 'services') {
        loadServices();
      } else if (tabId === 'orders') {
        loadOrders();
      } else if (tabId === 'new-order') {
        populateServiceDropdown();
      } else if (tabId === 'deposit') {
        loadPaymentHistory();
      }
    });
  });
  
  // Set API key (hardcoded for this implementation)
  const API_KEY = '4e59a83d29629d875f9eaa48134d630d';
  localStorage.setItem('smmPanelApiKey', API_KEY);
  
  // Refresh balance button
  document.getElementById('refresh-balance').addEventListener('click', loadBalance);
  
  // Refresh orders button
  document.getElementById('refresh-orders').addEventListener('click', loadOrders);
  
  // Modal functionality
  const modals = document.querySelectorAll('.modal');
  const closeButtons = document.querySelectorAll('.close-modal');
  
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      modals.forEach(modal => modal.style.display = 'none');
    });
  });
  
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      modals.forEach(modal => modal.style.display = 'none');
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
  const depositBtn = document.getElementById('deposit-btn');
  depositBtn.addEventListener('click', createDeposit);
  
  const checkStatusBtn = document.getElementById('check-status');
  checkStatusBtn.addEventListener('click', checkPaymentStatus);
  
  // Initial data loading
  loadBalance();
  loadServices();
  loadOrders();
  populateServiceDropdown();
  loadPaymentHistory();
  
  // Functions
  function getApiKey() {
    return localStorage.getItem('smmPanelApiKey');
  }
  
  function showError(message) {
    alert('Error: ' + message);
  }
  
  function showSuccess(message) {
    alert('Sukses: ' + message);
  }
  
  function formatRupiah(amount) {
    return 'Rp' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  
  function loadBalance() {
    const apiKey = getApiKey();
    if (!apiKey) return;
    
    fetch('/api/balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: apiKey })
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        showError(data.error);
      } else {
        document.getElementById('balance-amount').textContent = 
          `${formatRupiah(data.balance)} ${data.currency || ''}`;
      }
    })
    .catch(error => {
      showError(error.message);
    });
  }
  
  function loadServices() {
    const apiKey = getApiKey();
    if (!apiKey) return;
    
    const servicesList = document.getElementById('services-list');
    servicesList.innerHTML = '<div class="loading">Memuat layanan...</div>';
    
    fetch('/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: apiKey })
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
            <span class="service-price">${formatRupiah(service.rate)} per 1000</span>
          </div>
          <div class="service-minmax">Min: ${service.min} - Maks: ${service.max}</div>
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
    const apiKey = getApiKey();
    if (!apiKey) return;
    
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
              <span>Harga: ${formatRupiah(900)}</span>
            </div>
            <div class="order-status status-in-progress">Dalam Proses</div>
          </div>
          <div class="order-actions">
            <button class="action-btn refill-btn">Isi Ulang</button>
            <button class="action-btn cancel-btn">Batalkan</button>
            <button class="action-btn details-btn">Detail</button>
          </div>
        </div>
        <div class="order-card">
          <div class="order-info">
            <h3>YouTube Views</h3>
            <div class="order-meta">
              <span>Pesanan #23498</span>
              <span>Jumlah: 5000</span>
              <span>Harga: ${formatRupiah(5000)}</span>
            </div>
            <div class="order-status status-completed">Selesai</div>
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
      
      document.querySelectorAll('.refill-btn').forEach(button => {
        button.addEventListener('click', () => {
          alert('Fungsi isi ulang akan diimplementasikan di sini');
        });
      });
      
      document.querySelectorAll('.cancel-btn').forEach(button => {
        button.addEventListener('click', () => {
          alert('Fungsi pembatalan akan diimplementasikan di sini');
        });
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
        <p><strong>Harga:</strong> ${formatRupiah(900)}</p>
        <p><strong>Status:</strong> Dalam Proses</p>
        <p><strong>Jumlah Awal:</strong> 3572</p>
        <p><strong>Sisa:</strong> 157</p>
      </div>
    `;
    
    modal.style.display = 'flex';
  }
  
  function populateServiceDropdown() {
    const apiKey = getApiKey();
    if (!apiKey) return;
    
    const serviceSelect = document.getElementById('service-select');
    serviceSelect.innerHTML = '<option value="">Pilih layanan</option>';
    
    fetch('/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: apiKey })
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        showError(data.error);
      } else {
        data.forEach(service => {
          const option = document.createElement('option');
          option.value = service.service;
          option.textContent = `${service.name} (${formatRupiah(service.rate)} per 1000)`;
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
      document.getElementById('estimated-price').textContent = formatRupiah(0);
      return;
    }
    
    const rate = parseFloat(selectedOption.getAttribute('data-rate'));
    const quantity = parseInt(document.getElementById('service-quantity').value) || 0;
    
    const price = (rate * quantity / 1000);
    document.getElementById('estimated-price').textContent = formatRupiah(price);
  }
  
  function placeOrder(e) {
    e.preventDefault();
    
    const apiKey = getApiKey();
    if (!apiKey) {
      showError('Silakan masukkan API key terlebih dahulu');
      return;
    }
    
    const serviceId = document.getElementById('service-select').value;
    const link = document.getElementById('service-link').value;
    const quantity = document.getElementById('service-quantity').value;
    const runs = document.getElementById('service-runs').value;
    const interval = document.getElementById('service-interval').value;
    
    if (!serviceId || !link || !quantity) {
      showError('Silakan isi semua field yang diperlukan');
      return;
    }
    
    const orderData = {
      key: apiKey,
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
        showSuccess(`Pesanan berhasil dibuat! ID Pesanan: ${data.order}`);
        // Reset form
        document.getElementById('order-form').reset();
        document.getElementById('estimated-price').textContent = formatRupiah(0);
        // Switch to orders tab
        document.querySelector('nav li[data-tab="orders"]').click();
        // Refresh orders list
        loadOrders();
        // Refresh balance
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
        const trx = data.transaction;
        document.getElementById('qr-code-img').src = `data:image/png;base64,${trx.qr_code}`;
        document.getElementById('trx-id').textContent = trx.reff_id;
        document.getElementById('trx-amount').textContent = formatRupiah(trx.amount);
        document.getElementById('trx-fee').textContent = formatRupiah(trx.fee);
        document.getElementById('trx-received').textContent = formatRupiah(trx.received);
        document.getElementById('trx-expiry').textContent = trx.expired_at;
        document.getElementById('qr-string').textContent = trx.qr_string;
        
        document.getElementById('payment-info').style.display = 'block';
        
        // Save transaction to history
        saveTransactionToHistory(trx);
        
        // Start checking payment status
        checkPaymentStatus(trx.id);
      }
    })
    .catch(error => {
      showError('Gagal membuat transaksi deposit: ' + error.message);
    });
  }
  
  function checkPaymentStatus(trxId = null) {
    if (!trxId) {
      trxId = document.getElementById('trx-id').textContent;
      if (!trxId) return;
    }
    
    fetch(`/api/payment/status?trxid=${trxId}`)
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        showError(data.error);
      } else {
        const status = data.data.status;
        const modal = document.getElementById('payment-modal');
        const paymentStatus = document.getElementById('payment-status');
        
        if (status === 'success') {
          paymentStatus.innerHTML = `
            <div class="payment-status success">
              <h3>Pembayaran Berhasil!</h3>
              <p>Saldo telah ditambahkan ke akun Anda.</p>
              <p><strong>ID Transaksi:</strong> ${data.data.reff_id}</p>
              <p><strong>Jumlah:</strong> ${formatRupiah(data.data.saldo_masuk)}</p>
            </div>
          `;
          
          // Refresh balance
          loadBalance();
          // Refresh payment history
          loadPaymentHistory();
        } else if (status === 'pending') {
          paymentStatus.innerHTML = `
            <div class="payment-status pending">
              <h3>Menunggu Pembayaran</h3>
              <p>Silakan selesaikan pembayaran sebelum waktu habis.</p>
              <p><strong>Batas Waktu:</strong> ${data.data.expired_at}</p>
            </div>
          `;
        } else {
          paymentStatus.innerHTML = `
            <div class="payment-status failed">
              <h3>Pembayaran Gagal</h3>
              <p>${data.data.message || 'Pembayaran tidak berhasil diproses.'}</p>
            </div>
          `;
        }
        
        modal.style.display = 'flex';
        
        // Update history if status changed
        updateTransactionStatus(trxId, status);
      }
    })
    .catch(error => {
      showError('Gagal memeriksa status pembayaran: ' + error.message);
    });
  }
  
  function saveTransactionToHistory(trx) {
    let history = JSON.parse(localStorage.getItem('paymentHistory')) || [];
    
    // Check if transaction already exists
    const existingIndex = history.findIndex(item => item.id === trx.id);
    
    if (existingIndex >= 0) {
      history[existingIndex] = {
        id: trx.id,
        reff_id: trx.reff_id,
        amount: trx.amount,
        fee: trx.fee,
        received: trx.received,
        date: new Date().toISOString(),
        status: 'pending'
      };
    } else {
      history.unshift({
        id: trx.id,
        reff_id: trx.reff_id,
        amount: trx.amount,
        fee: trx.fee,
        received: trx.received,
        date: new Date().toISOString(),
        status: 'pending'
      });
    }
    
    localStorage.setItem('paymentHistory', JSON.stringify(history));
    loadPaymentHistory();
  }
  
  function updateTransactionStatus(trxId, status) {
    let history = JSON.parse(localStorage.getItem('paymentHistory')) || [];
    const index = history.findIndex(item => item.id === trxId);
    
    if (index >= 0) {
      history[index].status = status;
      localStorage.setItem('paymentHistory', JSON.stringify(history));
      loadPaymentHistory();
    }
  }
  
  function loadPaymentHistory() {
    const historyList = document.getElementById('history-list');
    const history = JSON.parse(localStorage.getItem('paymentHistory')) || [];
    
    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty">Belum ada transaksi</div>';
      return;
    }
    
    let html = '';
    
    history.forEach(trx => {
      let statusClass = 'status-pending';
      let statusText = 'Menunggu';
      
      if (trx.status === 'success') {
        statusClass = 'status-success';
        statusText = 'Berhasil';
      } else if (trx.status === 'failed') {
        statusClass = 'status-failed';
        statusText = 'Gagal';
      }
      
      html += `
        <div class="history-item">
          <div>
            <p><strong>${trx.reff_id}</strong></p>
            <p>${new Date(trx.date).toLocaleString()}</p>
          </div>
          <div>
            <p><strong>${formatRupiah(trx.received)}</strong></p>
            <span class="status ${statusClass}">${statusText}</span>
          </div>
        </div>
      `;
    });
    
    historyList.innerHTML = html;
  }
});