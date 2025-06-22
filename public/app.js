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
  
  // Show loading immediately
  showLoading(loadingElement, 'Memuat layanan...');
  
  // Set timeout for minimum loading time
  const minLoadingTime = 1000; // 1 second minimum loading
  const loadingStartTime = Date.now();
  
  fetchServices();
  
  function fetchServices() {
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
      const elapsed = Date.now() - loadingStartTime;
      const remainingTime = minLoadingTime - elapsed;
      
      if (remainingTime > 0) {
        setTimeout(() => {
          processServiceData(data);
        }, remainingTime);
      } else {
        processServiceData(data);
      }
    })
    .catch(error => {
      console.error('Error:', error);
      hideLoading(loadingElement);
      servicesTable.innerHTML = `<tr><td colspan="7" class="error-message">Error memuat layanan: ${error.message}</td></tr>`;
    });
  }
  
  function processServiceData(data) {
    hideLoading(loadingElement);
    if (Array.isArray(data)) {
      displayServices(data);
      populateCategoryFilter(data);
    } else {
      servicesTable.innerHTML = '<tr><td colspan="7" class="error-message">Gagal memuat layanan. Silakan coba lagi.</td></tr>';
    }
  }
  
  function displayServices(services) {
    servicesTable.innerHTML = '';
    
    if (services.length === 0) {
      servicesTable.innerHTML = '<tr><td colspan="7" class="empty-message">Tidak ada layanan tersedia</td></tr>';
      return;
    }
    
    services.forEach(service => {
      const row = document.createElement('tr');
      
      const ratePer1000 = service.rate ? parseFloat(service.rate) : config.DEFAULT_RATE;
      
      row.innerHTML = `
        <td>${service.service}</td>
        <td>${service.name} <span class="service-type">(${service.type})</span></td>
        <td><span class="service-category">${service.category}</span></td>
        <td>Rp${ratePer1000.toLocaleString('id-ID')}</td>
        <td>${service.min}</td>
        <td>${service.max}</td>
        <td><a href="/order.html?service=${service.service}" class="btn primary small">Pesan</a></td>
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
    let visibleRows = 0;
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length === 0) return;
      
      const serviceName = cells[1].textContent.toLowerCase();
      const serviceCategory = cells[2].textContent;
      
      const matchesSearch = serviceName.includes(searchTerm);
      const matchesCategory = selectedCategory === '' || serviceCategory === selectedCategory;
      
      if (matchesSearch && matchesCategory) {
        row.style.display = '';
        visibleRows++;
      } else {
        row.style.display = 'none';
      }
    });
    
    // Show empty message if no rows visible
    const emptyMessage = servicesTable.querySelector('.empty-message');
    if (visibleRows === 0 && !emptyMessage) {
      servicesTable.innerHTML = '<tr><td colspan="7" class="empty-message">Tidak ada layanan yang sesuai dengan filter</td></tr>';
    } else if (visibleRows > 0 && emptyMessage) {
      // If we have results but empty message is still there, reload services
      fetchServices();
    }
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
          showAlert('error', 'Layanan tidak ditemukan. Silakan cek ID Layanan.');
        }
      }
    })
    .catch(error => {
      console.error('Error fetching service details:', error);
      showAlert('error', `Gagal memuat detail layanan: ${error.message}`);
    });
  }
  
  function updatePriceCalculation() {
    const quantity = parseInt(quantityInput.value) || 0;
    const rate = parseFloat(serviceIdInput.dataset.rate) || config.DEFAULT_RATE;
    
    quantityDisplay.textContent = quantity.toLocaleString('id-ID');
    
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
      showAlert('error', 'Silakan masukkan ID Layanan');
      return;
    }
    
    if (!document.getElementById('link').value) {
      showAlert('error', 'Silakan masukkan link halaman');
      return;
    }
    
    const quantity = parseInt(quantityInput.value);
    if (!quantity || quantity < parseInt(quantityInput.min) || quantity > parseInt(quantityInput.max)) {
      showAlert('error', `Jumlah tidak valid. Harap masukkan nilai antara ${quantityInput.min} dan ${quantityInput.max}`);
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
          showAlert('error', errorMsg);
          reject(new Error(errorMsg));
        }
      })
      .catch(error => {
        console.error('Error membuat pesanan:', error);
        showAlert('error', `Gagal membuat pesanan: ${error.message}`);
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
        expiryTime.textContent = formatExpiryTime(data.data.expired_at);
        
        paymentModal.style.display = 'block';
        paymentModal.dataset.paymentId = data.data.id;
        paymentModal.dataset.orderId = orderId;
        
        showAlert('info', 'Silakan scan QR code untuk melakukan pembayaran');
        
        // Auto check payment status every 10 seconds
        const paymentId = data.data.id;
        const intervalId = setInterval(() => {
          if (paymentModal.style.display === 'none') {
            clearInterval(intervalId);
            return;
          }
          checkPayment(paymentId, orderId, false);
        }, 10000);
        
        // Store interval ID to clear later
        paymentModal.dataset.intervalId = intervalId;
      } else {
        const errorMsg = data.error || 'Gagal membuat pembayaran: Error tidak diketahui';
        showAlert('error', errorMsg);
      }
    })
    .catch(error => {
      console.error('Error membuat pembayaran:', error);
      showAlert('error', `Gagal membuat pembayaran: ${error.message}`);
    });
  }
  
  function formatExpiryTime(expiry) {
    if (!expiry) return '-';
    const expiryDate = new Date(expiry);
    return expiryDate.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  function checkPayment(paymentId, orderId, showLoading = true) {
    if (!paymentId) return;
    
    if (showLoading) {
      showLoading(paymentStatus, 'Memeriksa status pembayaran...');
    }
    
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
      if (showLoading) hideLoading(paymentStatus);
      
      if (data.success && data.data.status === 'paid') {
        showAlert('success', `Pembayaran berhasil! Pesanan #${orderId} sedang diproses.`);
        
        setTimeout(() => {
          paymentModal.style.display = 'none';
          window.location.href = `/status.html?order=${orderId}`;
        }, 3000);
      } else {
        const status = data.data?.status || 'pending';
        if (showLoading) {
          showAlert('warning', `Pembayaran belum selesai. Status: ${status}`);
        }
      }
    })
    .catch(error => {
      console.error('Error memverifikasi pembayaran:', error);
      if (showLoading) {
        showAlert('error', `Gagal memverifikasi pembayaran: ${error.message}`);
      }
    });
  }
  
  closeModal.addEventListener('click', function() {
    // Clear the auto-check interval
    if (paymentModal.dataset.intervalId) {
      clearInterval(paymentModal.dataset.intervalId);
    }
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
    
    checkPayment(paymentId, orderId)
      .finally(() => {
        // Kembalikan tombol ke keadaan semula
        checkPaymentStatus.innerHTML = originalButtonText;
        checkPaymentStatus.disabled = false;
      });
  });
  
  window.addEventListener('click', function(event) {
    if (event.target === paymentModal) {
      // Clear the auto-check interval
      if (paymentModal.dataset.intervalId) {
        clearInterval(paymentModal.dataset.intervalId);
      }
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
      showAlert('error', `Gagal memeriksa status massal: ${error.message}`, bulkStatusResult);
    });
  }
  
  function displayStatusResult(orderId, data) {
    noStatus.classList.add('hidden');
    statusCard.classList.remove('hidden');
    
    document.getElementById('statusOrderId').textContent = orderId;
    document.getElementById('statusText').textContent = data.status;
    document.getElementById('statusText').className = 'status-badge ' + getStatusClass(data.status);
    document.getElementById('statusCharge').textContent = data.charge ? data.charge.toLocaleString('id-ID') : '-';
    document.getElementById('statusStartCount').textContent = data.start_count ? data.start_count.toLocaleString('id-ID') : '-';
    document.getElementById('statusRemains').textContent = data.remains ? data.remains.toLocaleString('id-ID') : '-';
    document.getElementById('statusCurrency').textContent = data.currency || '-';
  }
  
  function getStatusClass(status) {
    if (!status) return 'error';
    const lowerStatus = status.toLowerCase();
    
    if (lowerStatus.includes('complete') || lowerStatus.includes('selesai')) return 'completed';
    if (lowerStatus.includes('partial')) return 'partial';
    if (lowerStatus.includes('process') || lowerStatus.includes('proses')) return 'processing';
    if (lowerStatus.includes('pending')) return 'pending';
    if (lowerStatus.includes('cancel') || lowerStatus.includes('batal')) return 'cancelled';
    if (lowerStatus.includes('fail') || lowerStatus.includes('gagal')) return 'failed';
    if (lowerStatus.includes('error')) return 'error';
    
    return 'info';
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
    // Clear previous errors
    const existingError = statusDetails.querySelector('.status-error');
    if (existingError) existingError.remove();
    
    const errorElement = document.createElement('p');
    errorElement.className = 'status-error';
    errorElement.textContent = `Error: ${error}`;
    errorElement.style.color = 'var(--danger-color)';
    statusDetails.appendChild(errorElement);
  }
  
  function displayBulkStatusResult(data) {
    bulkStatusResult.innerHTML = '';
    
    if (typeof data !== 'object' || data === null) {
      showAlert('error', 'Format respon tidak valid', bulkStatusResult);
      return;
    }
    
    const table = document.createElement('table');
    table.className = 'bulk-status-table';
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
      if (!data.hasOwnProperty(orderId)) continue;
      
      const orderData = data[orderId];
      const row = document.createElement('tr');
      
      if (orderData.error) {
        row.innerHTML = `
          <td>${orderId}</td>
          <td colspan="4" class="error">${orderData.error}</td>
        `;
      } else {
        const statusClass = getStatusClass(orderData.status);
        row.innerHTML = `
          <td>${orderId}</td>
          <td><span class="status-badge ${statusClass}">${orderData.status || '-'}</span></td>
          <td>${orderData.charge ? orderData.charge.toLocaleString('id-ID') : '-'}</td>
          <td>${orderData.start_count ? orderData.start_count.toLocaleString('id-ID') : '-'}</td>
          <td>${orderData.remains ? orderData.remains.toLocaleString('id-ID') : '-'}</td>
        `;
      }
      
      tbody.appendChild(row);
    }
  }
}

// Helper function to show alerts
function showAlert(type, message, container = document.body) {
  // Remove existing alerts first
  const existingAlert = container.querySelector('.alert');
  if (existingAlert) existingAlert.remove();
  
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert ${type}`;
  alertDiv.innerHTML = `
    <i class="fas fa-${type === 'error' ? 'times-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
    <p>${message}</p>
  `;
  
  if (container === document.body) {
    // For body alerts, position them fixed
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.left = '50%';
    alertDiv.style.transform = 'translateX(-50%)';
    alertDiv.style.zIndex = '1000';
    alertDiv.style.maxWidth = '90%';
    alertDiv.style.width = 'auto';
    alertDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
      alertDiv.style.opacity = '1';
      setTimeout(() => {
        alertDiv.style.opacity = '0';
        setTimeout(() => {
          alertDiv.remove();
        }, 300);
      }, 3000);
    }, 10);
  } else {
    // For container alerts, append normally
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => {
      alertDiv.remove();
    }, 5000);
  }
}