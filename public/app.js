// app.js
document.addEventListener('DOMContentLoaded', function() {
  const path = window.location.pathname;
  
  if (path.endsWith('services.html')) {
    initServicesPage();
  } else if (path.endsWith('order.html')) {
    initOrderPage();
  } else if (path.endsWith('status.html')) {
    initStatusPage();
  }
});

// Fungsi untuk menampilkan loading
function showLoading(element, text = 'Memproses...') {
  if (!element) return;
  
  element.innerHTML = `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>${text}</p>
    </div>
  `;
  element.style.display = 'block';
}

// Fungsi untuk menyembunyikan loading
function hideLoading(element) {
  if (!element) return;
  
  element.style.display = 'none';
  element.innerHTML = '';
}

// Services Page Logic
function initServicesPage() {
  const servicesTable = document.getElementById('servicesList');
  const loadingElement = document.getElementById('loading');
  const searchInput = document.getElementById('serviceSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  
  fetchServices();
  
  function fetchServices() {
    showLoading(loadingElement, 'Memuat layanan...');
    servicesTable.innerHTML = '';
    
    fetch(config.API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'services'
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Gagal memuat layanan');
      }
      return response.json();
    })
    .then(data => {
      hideLoading(loadingElement);
      if (Array.isArray(data)) {
        displayServices(data);
        populateCategoryFilter(data);
      } else {
        servicesTable.innerHTML = '<tr><td colspan="7">Gagal memuat layanan. Silakan coba lagi.</td></tr>';
      }
    })
    .catch(error => {
      console.error('Error:', error);
      hideLoading(loadingElement);
      servicesTable.innerHTML = `<tr><td colspan="7">Error memuat layanan: ${error.message}</td></tr>`;
    });
  }
  
  function displayServices(services) {
    servicesTable.innerHTML = '';
    
    services.forEach(service => {
      const row = document.createElement('tr');
      
      // Calculate price per 1000
      const ratePer1000 = service.rate ? parseFloat(service.rate) : config.DEFAULT_RATE;
      
      row.innerHTML = `
        <td>${service.service}</td>
        <td>${service.name} (${service.type})</td>
        <td>${service.category}</td>
        <td>Rp${ratePer1000.toLocaleString('id-ID')}</td>
        <td>${service.min}</td>
        <td>${service.max}</td>
        <td><a href="/order.html?service=${service.service}" class="btn primary small">Pesan Sekarang</a></td>
      `;
      
      servicesTable.appendChild(row);
    });
  }
  
  function populateCategoryFilter(services) {
    const categories = new Set();
    services.forEach(service => categories.add(service.category));
    
    categoryFilter.innerHTML = '<option value="">Semua Kategori</option>';
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
  }
  
  searchInput.addEventListener('input', filterServices);
  categoryFilter.addEventListener('change', filterServices);
  
  function filterServices() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    
    const rows = servicesTable.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length === 0) return;
      
      const serviceName = cells[1].textContent.toLowerCase();
      const serviceCategory = cells[2].textContent;
      
      const matchesSearch = serviceName.includes(searchTerm);
      const matchesCategory = selectedCategory === '' || serviceCategory === selectedCategory;
      
      row.style.display = matchesSearch && matchesCategory ? '' : 'none';
    });
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  const serviceId = urlParams.get('service');
  if (serviceId) {
    window.location.href = `/order.html?service=${serviceId}`;
  }
}

// Order Page Logic
function initOrderPage() {
  const orderForm = document.getElementById('orderForm');
  const serviceIdInput = document.getElementById('serviceId');
  const quantityInput = document.getElementById('quantity');
  const quantityInfo = document.getElementById('quantityInfo');
  const rateDisplay = document.getElementById('rateDisplay');
  const quantityDisplay = document.getElementById('quantityDisplay');
  const totalPrice = document.getElementById('totalPrice');
  const paymentModal = document.getElementById('paymentModal');
  const closeModal = document.querySelector('.close');
  const qrCodeImage = document.getElementById('qrCodeImage');
  const orderIdDisplay = document.getElementById('orderIdDisplay');
  const paymentAmount = document.getElementById('paymentAmount');
  const expiryTime = document.getElementById('expiryTime');
  const checkPaymentStatus = document.getElementById('checkPaymentStatus');
  const paymentStatus = document.getElementById('paymentStatus');
  const submitButton = orderForm.querySelector('button[type="submit"]');
  const submitButtonText = document.getElementById('submitButtonText');
  const checkStatusText = document.getElementById('checkStatusText');
  
  const urlParams = new URLSearchParams(window.location.search);
  const serviceIdParam = urlParams.get('service');
  if (serviceIdParam) {
    serviceIdInput.value = serviceIdParam;
    fetchServiceDetails(serviceIdParam);
  }
  
  serviceIdInput.addEventListener('change', function() {
    if (this.value) {
      fetchServiceDetails(this.value);
    }
  });
  
  quantityInput.addEventListener('input', updatePriceCalculation);
  
  function fetchServiceDetails(serviceId) {
    showLoading(paymentStatus, 'Memuat detail layanan...');
    
    fetch(config.API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'services'
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Gagal memuat detail layanan');
      }
      return response.json();
    })
    .then(data => {
      hideLoading(paymentStatus);
      if (Array.isArray(data)) {
        const service = data.find(s => s.service == serviceId);
        if (service) {
          quantityInput.min = service.min;
          quantityInput.max = service.max;
          quantityInfo.textContent = `Min: ${service.min}, Max: ${service.max}`;
          
          const ratePer1000 = service.rate ? parseFloat(service.rate) : config.DEFAULT_RATE;
          rateDisplay.textContent = `Rp${ratePer1000.toLocaleString('id-ID')}`;
          
          serviceIdInput.dataset.rate = ratePer1000;
          updatePriceCalculation();
        } else {
          paymentStatus.innerHTML = `
            <div class="alert error">
              <i class="fas fa-times-circle"></i>
              <p>Layanan tidak ditemukan. Silakan cek ID Layanan.</p>
            </div>
          `;
        }
      }
    })
    .catch(error => {
      console.error('Error fetching service details:', error);
      paymentStatus.innerHTML = `
        <div class="alert error">
          <i class="fas fa-times-circle"></i>
          <p>Gagal memuat detail layanan: ${error.message}</p>
        </div>
      `;
    });
  }
  
  function updatePriceCalculation() {
    const quantity = parseInt(quantityInput.value) || 0;
    const rate = parseFloat(serviceIdInput.dataset.rate) || config.DEFAULT_RATE;
    
    quantityDisplay.textContent = quantity;
    
    if (quantity > 0) {
      const price = Math.ceil((quantity / 1000) * rate);
      totalPrice.textContent = `Rp${price.toLocaleString('id-ID')}`;
    } else {
      totalPrice.textContent = 'Rp0';
    }
  }
  
  orderForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Validasi form
    if (!serviceIdInput.value) {
      paymentStatus.innerHTML = `
        <div class="alert error">
          <i class="fas fa-times-circle"></i>
          <p>Silakan masukkan ID Layanan</p>
        </div>
      `;
      return;
    }
    
    if (!document.getElementById('link').value) {
      paymentStatus.innerHTML = `
        <div class="alert error">
          <i class="fas fa-times-circle"></i>
          <p>Silakan masukkan link halaman</p>
        </div>
      `;
      return;
    }
    
    const quantity = parseInt(quantityInput.value);
    if (!quantity || quantity < parseInt(quantityInput.min) || quantity > parseInt(quantityInput.max)) {
      paymentStatus.innerHTML = `
        <div class="alert error">
          <i class="fas fa-times-circle"></i>
          <p>Jumlah tidak valid. Harap masukkan nilai antara ${quantityInput.min} dan ${quantityInput.max}</p>
        </div>
      `;
      return;
    }
    
    // Simpan teks asli tombol
    const originalButtonText = submitButton.innerHTML;
    
    // Tampilkan loading pada tombol
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    submitButton.disabled = true;
    
    const serviceId = serviceIdInput.value;
    const link = document.getElementById('link').value;
    const quantity = quantityInput.value;
    const runs = document.getElementById('runs').value || undefined;
    const interval = document.getElementById('interval').value || undefined;
    
    const rate = parseFloat(serviceIdInput.dataset.rate) || config.DEFAULT_RATE;
    const amount = Math.ceil((quantity / 1000) * rate);
    
    createOrder(serviceId, link, quantity, runs, interval, amount)
      .finally(() => {
        // Kembalikan tombol ke keadaan semula
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
      });
  });
  
  function createOrder(serviceId, link, quantity, runs, interval, amount) {
    return new Promise((resolve, reject) => {
      showLoading(paymentStatus, 'Membuat pesanan...');
      
      fetch(config.API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'add',
          service: serviceId,
          link: link,
          quantity: quantity,
          runs: runs,
          interval: interval
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Gagal membuat pesanan');
        }
        return response.json();
      })
      .then(data => {
        if (data.order) {
          showPaymentModal(data.order, amount);
          resolve(data);
        } else {
          const errorMsg = data.error || 'Gagal membuat pesanan: Error tidak diketahui';
          paymentStatus.innerHTML = `
            <div class="alert error">
              <i class="fas fa-times-circle"></i>
              <p>${errorMsg}</p>
            </div>
          `;
          reject(new Error(errorMsg));
        }
      })
      .catch(error => {
        console.error('Error membuat pesanan:', error);
        paymentStatus.innerHTML = `
          <div class="alert error">
            <i class="fas fa-times-circle"></i>
            <p>Gagal membuat pesanan: ${error.message}</p>
          </div>
        `;
        reject(error);
      });
    });
  }
  
  function showPaymentModal(orderId, amount) {
    showLoading(paymentStatus, 'Membuat pembayaran QRIS...');
    
    fetch(config.PAYMENT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount,
        orderId: orderId
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Gagal membuat pembayaran');
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        qrCodeImage.src = data.data.qrImageUrl;
        orderIdDisplay.textContent = orderId;
        paymentAmount.textContent = `Rp${amount.toLocaleString('id-ID')}`;
        expiryTime.textContent = data.data.expired_at;
        
        paymentModal.style.display = 'block';
        paymentModal.dataset.paymentId = data.data.id;
        paymentModal.dataset.orderId = orderId;
        
        paymentStatus.innerHTML = `
          <div class="alert info">
            <i class="fas fa-info-circle"></i>
            <p>Silakan scan QR code untuk melakukan pembayaran</p>
          </div>
        `;
      } else {
        const errorMsg = data.error || 'Gagal membuat pembayaran: Error tidak diketahui';
        paymentStatus.innerHTML = `
          <div class="alert error">
            <i class="fas fa-times-circle"></i>
            <p>${errorMsg}</p>
          </div>
        `;
      }
    })
    .catch(error => {
      console.error('Error membuat pembayaran:', error);
      paymentStatus.innerHTML = `
        <div class="alert error">
          <i class="fas fa-times-circle"></i>
          <p>Gagal membuat pembayaran: ${error.message}</p>
        </div>
      `;
    });
  }
  
  closeModal.addEventListener('click', function() {
    paymentModal.style.display = 'none';
  });
  
  checkPaymentStatus.addEventListener('click', function() {
    const paymentId = paymentModal.dataset.paymentId;
    const orderId = paymentModal.dataset.orderId;
    
    if (!paymentId) return;
    
    // Simpan teks asli tombol
    const originalButtonText = checkPaymentStatus.innerHTML;
    
    // Tampilkan loading pada tombol
    checkPaymentStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...';
    checkPaymentStatus.disabled = true;
    
    showLoading(paymentStatus, 'Memeriksa status pembayaran...');
    
    fetch(config.VERIFY_PAYMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentId: paymentId
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Gagal memverifikasi pembayaran');
      }
      return response.json();
    })
    .then(data => {
      if (data.success && data.data.status === 'paid') {
        paymentStatus.innerHTML = `
          <div class="alert success">
            <i class="fas fa-check-circle"></i>
            <p>Pembayaran berhasil! Pesanan #${orderId} sedang diproses.</p>
          </div>
        `;
        
        setTimeout(() => {
          paymentModal.style.display = 'none';
          window.location.href = `/status.html?order=${orderId}`;
        }, 3000);
      } else {
        const status = data.data?.status || 'pending';
        paymentStatus.innerHTML = `
          <div class="alert warning">
            <i class="fas fa-exclamation-circle"></i>
            <p>Pembayaran belum selesai. Status: ${status}</p>
          </div>
        `;
      }
    })
    .catch(error => {
      console.error('Error memverifikasi pembayaran:', error);
      paymentStatus.innerHTML = `
        <div class="alert error">
          <i class="fas fa-times-circle"></i>
          <p>Gagal memverifikasi pembayaran: ${error.message}</p>
        </div>
      `;
    })
    .finally(() => {
      // Kembalikan tombol ke keadaan semula
      checkPaymentStatus.innerHTML = originalButtonText;
      checkPaymentStatus.disabled = false;
    });
  });
  
  window.addEventListener('click', function(event) {
    if (event.target === paymentModal) {
      paymentModal.style.display = 'none';
    }
  });
}

// Status Page Logic
function initStatusPage() {
  const orderIdInput = document.getElementById('orderIdInput');
  const checkStatusBtn = document.getElementById('checkStatusBtn');
  const statusCard = document.getElementById('statusCard');
  const noStatus = document.getElementById('noStatus');
  const bulkOrderIds = document.getElementById('bulkOrderIds');
  const checkBulkStatusBtn = document.getElementById('checkBulkStatusBtn');
  const bulkStatusResult = document.getElementById('bulkStatusResult');
  
  const urlParams = new URLSearchParams(window.location.search);
  const orderIdParam = urlParams.get('order');
  if (orderIdParam) {
    orderIdInput.value = orderIdParam;
    checkOrderStatus(orderIdParam);
  }
  
  checkStatusBtn.addEventListener('click', function() {
    const orderId = orderIdInput.value.trim();
    if (orderId) {
      checkOrderStatus(orderId);
    } else {
      showAlert('error', 'Silakan masukkan ID Pesanan');
    }
  });
  
  checkBulkStatusBtn.addEventListener('click', function() {
    const orderIds = bulkOrderIds.value.trim();
    if (orderIds) {
      checkBulkOrderStatus(orderIds);
    } else {
      showAlert('error', 'Silakan masukkan ID Pesanan');
    }
  });
  
  function checkOrderStatus(orderId) {
    showLoading(noStatus, 'Memeriksa status pesanan...');
    statusCard.classList.add('hidden');
    
    fetch(config.API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'status',
        order: orderId
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Gagal memeriksa status pesanan');
      }
      return response.json();
    })
    .then(data => {
      hideLoading(noStatus);
      if (data.error) {
        displayStatusError(orderId, data.error);
      } else {
        displayStatusResult(orderId, data);
      }
    })
    .catch(error => {
      console.error('Error checking order status:', error);
      displayStatusError(orderId, error.message);
    });
  }
  
  function checkBulkOrderStatus(orderIds) {
    showLoading(bulkStatusResult, 'Memeriksa status pesanan...');
    
    fetch(config.API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'status',
        orders: orderIds
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Gagal memeriksa status massal');
      }
      return response.json();
    })
    .then(data => {
      hideLoading(bulkStatusResult);
      displayBulkStatusResult(data);
    })
    .catch(error => {
      console.error('Error checking bulk order status:', error);
      bulkStatusResult.innerHTML = `
        <div class="alert error">
          <i class="fas fa-times-circle"></i>
          <p>Gagal memeriksa status massal: ${error.message}</p>
        </div>
      `;
    });
  }
  
  function displayStatusResult(orderId, data) {
    noStatus.classList.add('hidden');
    statusCard.classList.remove('hidden');
    
    document.getElementById('statusOrderId').textContent = orderId;
    document.getElementById('statusText').textContent = data.status;
    document.getElementById('statusText').className = 'status-badge ' + data.status.toLowerCase().replace(' ', '-');
    document.getElementById('statusCharge').textContent = data.charge;
    document.getElementById('statusStartCount').textContent = data.start_count;
    document.getElementById('statusRemains').textContent = data.remains;
    document.getElementById('statusCurrency').textContent = data.currency;
  }
  
  function displayStatusError(orderId, error) {
    noStatus.classList.add('hidden');
    statusCard.classList.remove('hidden');
    
    document.getElementById('statusOrderId').textContent = orderId;
    document.getElementById('statusText').textContent = 'Error';
    document.getElementById('statusText').className = 'status-badge error';
    document.getElementById('statusCharge').textContent = '-';
    document.getElementById('statusStartCount').textContent = '-';
    document.getElementById('statusRemains').textContent = '-';
    document.getElementById('statusCurrency').textContent = '-';
    
    const statusDetails = document.querySelector('.status-details');
    const errorElement = document.createElement('p');
    errorElement.textContent = `Error: ${error}`;
    errorElement.style.color = 'var(--danger-color)';
    statusDetails.appendChild(errorElement);
  }
  
  function displayBulkStatusResult(data) {
    bulkStatusResult.innerHTML = '';
    
    if (typeof data !== 'object') {
      bulkStatusResult.innerHTML = `
        <div class="alert error">
          <i class="fas fa-times-circle"></i>
          <p>Format respon tidak valid</p>
        </div>
      `;
      return;
    }
    
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>ID Pesanan</th>
          <th>Status</th>
          <th>Biaya</th>
          <th>Jumlah Awal</th>
          <th>Sisa</th>
        </tr>
      </thead>
      <tbody id="bulkStatusList"></tbody>
    `;
    
    bulkStatusResult.appendChild(table);
    const tbody = document.getElementById('bulkStatusList');
    
    for (const orderId in data) {
      const orderData = data[orderId];
      const row = document.createElement('tr');
      
      if (orderData.error) {
        row.innerHTML = `
          <td>${orderId}</td>
          <td colspan="4" class="error">${orderData.error}</td>
        `;
      } else {
        row.innerHTML = `
          <td>${orderId}</td>
          <td><span class="status-badge ${orderData.status.toLowerCase().replace(' ', '-')}">${orderData.status}</span></td>
          <td>${orderData.charge}</td>
          <td>${orderData.start_count}</td>
          <td>${orderData.remains}</td>
        `;
      }
      
      tbody.appendChild(row);
    }
  }
  
  function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${type}`;
    alertDiv.innerHTML = `
      <i class="fas fa-${type === 'error' ? 'times-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
      <p>${message}</p>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
      alertDiv.remove();
    }, 3000);
  }
}