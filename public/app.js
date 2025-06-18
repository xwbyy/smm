document.addEventListener('DOMContentLoaded', function() {
  // Initialize based on current page
  const path = window.location.pathname;
  
  if (path.endsWith('services.html')) {
    initServicesPage();
  } else if (path.endsWith('order.html')) {
    initOrderPage();
  } else if (path.endsWith('status.html')) {
    initStatusPage();
  }
});

// Services Page Logic
function initServicesPage() {
  const servicesTable = document.getElementById('servicesList');
  const loadingElement = document.getElementById('loading');
  const searchInput = document.getElementById('serviceSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  
  // Fetch services from API
  fetchServices();
  
  function fetchServices() {
    loadingElement.style.display = 'block';
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
    .then(response => response.json())
    .then(data => {
      loadingElement.style.display = 'none';
      if (Array.isArray(data)) {
        displayServices(data);
        populateCategoryFilter(data);
      } else {
        servicesTable.innerHTML = '<tr><td colspan="7">Failed to load services. Please try again.</td></tr>';
      }
    })
    .catch(error => {
      console.error('Error:', error);
      loadingElement.style.display = 'none';
      servicesTable.innerHTML = '<tr><td colspan="7">Error loading services. Please refresh the page.</td></tr>';
    });
  }
  
  function displayServices(services) {
    servicesTable.innerHTML = '';
    
    services.forEach(service => {
      const row = document.createElement('tr');
      
      // Calculate price per 1000
      const ratePer1000 = service.rate ? parseFloat(service.rate) * 1000 : config.DEFAULT_RATE;
      
      row.innerHTML = `
        <td>${service.service}</td>
        <td>${service.name} (${service.type})</td>
        <td>${service.category}</td>
        <td>Rp${ratePer1000.toLocaleString('id-ID')}</td>
        <td>${service.min}</td>
        <td>${service.max}</td>
        <td><a href="/order.html?service=${service.service}" class="btn primary small">Order Now</a></td>
      `;
      
      servicesTable.appendChild(row);
    });
  }
  
  function populateCategoryFilter(services) {
    const categories = new Set();
    services.forEach(service => categories.add(service.category));
    
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
  }
  
  // Search and filter functionality
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
  
  // Check if we came from a service link with parameters
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
  
  // Check URL for service ID parameter
  const urlParams = new URLSearchParams(window.location.search);
  const serviceIdParam = urlParams.get('service');
  if (serviceIdParam) {
    serviceIdInput.value = serviceIdParam;
    fetchServiceDetails(serviceIdParam);
  }
  
  // Fetch service details when ID changes
  serviceIdInput.addEventListener('change', function() {
    if (this.value) {
      fetchServiceDetails(this.value);
    }
  });
  
  // Update quantity info and price calculation
  quantityInput.addEventListener('input', updatePriceCalculation);
  
  function fetchServiceDetails(serviceId) {
    fetch(config.API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'services'
      })
    })
    .then(response => response.json())
    .then(data => {
      if (Array.isArray(data)) {
        const service = data.find(s => s.service == serviceId);
        if (service) {
          // Update quantity constraints
          quantityInput.min = service.min;
          quantityInput.max = service.max;
          quantityInfo.textContent = `Min: ${service.min}, Max: ${service.max}`;
          
          // Update rate display
          const ratePer1000 = service.rate ? parseFloat(service.rate) * 1000 : config.DEFAULT_RATE;
          rateDisplay.textContent = `Rp${ratePer1000.toLocaleString('id-ID')}`;
          
          // Store service rate for calculations
          serviceIdInput.dataset.rate = ratePer1000;
          
          // Trigger price calculation
          updatePriceCalculation();
        } else {
          alert('Service not found. Please check the Service ID.');
        }
      }
    })
    .catch(error => {
      console.error('Error fetching service details:', error);
      alert('Failed to fetch service details. Please try again.');
    });
  }
  
  function updatePriceCalculation() {
    const quantity = parseInt(quantityInput.value) || 0;
    const rate = parseFloat(serviceIdInput.dataset.rate) || config.DEFAULT_RATE;
    
    quantityDisplay.textContent = quantity;
    
    if (quantity > 0) {
      const price = (quantity / 1000) * rate;
      totalPrice.textContent = `Rp${price.toLocaleString('id-ID')}`;
    } else {
      totalPrice.textContent = 'Rp0';
    }
  }
  
  // Form submission
  orderForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const serviceId = serviceIdInput.value;
    const link = document.getElementById('link').value;
    const quantity = quantityInput.value;
    const runs = document.getElementById('runs').value || undefined;
    const interval = document.getElementById('interval').value || undefined;
    
    // Calculate total price
    const rate = parseFloat(serviceIdInput.dataset.rate) || config.DEFAULT_RATE;
    const amount = Math.ceil((quantity / 1000) * rate);
    
    // Create order
    createOrder(serviceId, link, quantity, runs, interval, amount);
  });
  
  function createOrder(serviceId, link, quantity, runs, interval, amount) {
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
    .then(response => response.json())
    .then(data => {
      if (data.order) {
        // Show payment modal
        showPaymentModal(data.order, amount);
      } else {
        alert('Failed to create order. Please try again.');
      }
    })
    .catch(error => {
      console.error('Error creating order:', error);
      alert('Failed to create order. Please try again.');
    });
  }
  
  function showPaymentModal(orderId, amount) {
    // Create payment request
    fetch(config.PAYMENT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Update modal with payment details
        qrCodeImage.src = data.data.qrImageUrl;
        orderIdDisplay.textContent = orderId;
        paymentAmount.textContent = `Rp${amount.toLocaleString('id-ID')}`;
        expiryTime.textContent = data.data.expired_at;
        
        // Show modal
        paymentModal.style.display = 'block';
        
        // Store payment data for status checking
        paymentModal.dataset.paymentId = data.data.id;
        paymentModal.dataset.orderId = orderId;
      } else {
        alert('Failed to create payment. Please try again.');
      }
    })
    .catch(error => {
      console.error('Error creating payment:', error);
      alert('Failed to create payment. Please try again.');
    });
  }
  
  // Close modal
  closeModal.addEventListener('click', function() {
    paymentModal.style.display = 'none';
  });
  
  // Check payment status
  checkPaymentStatus.addEventListener('click', function() {
    const paymentId = paymentModal.dataset.paymentId;
    const orderId = paymentModal.dataset.orderId;
    
    if (!paymentId) return;
    
    paymentStatus.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Checking payment status...</p>';
    
    // In a real app, you would call your backend to check payment status
    // This is a simplified version
    setTimeout(() => {
      paymentStatus.innerHTML = `
        <div class="alert success">
          <i class="fas fa-check-circle"></i>
          <p>Payment completed! Your order #${orderId} is being processed.</p>
        </div>
      `;
      
      // Close modal after 3 seconds
      setTimeout(() => {
        paymentModal.style.display = 'none';
        window.location.href = `/status.html?order=${orderId}`;
      }, 3000);
    }, 2000);
  });
  
  // Close modal when clicking outside
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
  
  // Check URL for order ID parameter
  const urlParams = new URLSearchParams(window.location.search);
  const orderIdParam = urlParams.get('order');
  if (orderIdParam) {
    orderIdInput.value = orderIdParam;
    checkOrderStatus(orderIdParam);
  }
  
  // Single order status check
  checkStatusBtn.addEventListener('click', function() {
    const orderId = orderIdInput.value.trim();
    if (orderId) {
      checkOrderStatus(orderId);
    } else {
      alert('Please enter an Order ID');
    }
  });
  
  // Bulk order status check
  checkBulkStatusBtn.addEventListener('click', function() {
    const orderIds = bulkOrderIds.value.trim();
    if (orderIds) {
      checkBulkOrderStatus(orderIds);
    } else {
      alert('Please enter Order IDs');
    }
  });
  
  function checkOrderStatus(orderId) {
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
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        displayStatusError(orderId, data.error);
      } else {
        displayStatusResult(orderId, data);
      }
    })
    .catch(error => {
      console.error('Error checking order status:', error);
      displayStatusError(orderId, 'Failed to check status');
    });
  }
  
  function checkBulkOrderStatus(orderIds) {
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
    .then(response => response.json())
    .then(data => {
      displayBulkStatusResult(data);
    })
    .catch(error => {
      console.error('Error checking bulk order status:', error);
      bulkStatusResult.innerHTML = '<div class="alert error">Failed to check bulk status</div>';
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
    
    // Show error message
    const statusDetails = document.querySelector('.status-details');
    const errorElement = document.createElement('p');
    errorElement.textContent = `Error: ${error}`;
    errorElement.style.color = 'var(--danger-color)';
    statusDetails.appendChild(errorElement);
  }
  
  function displayBulkStatusResult(data) {
    bulkStatusResult.innerHTML = '';
    
    if (typeof data !== 'object') {
      bulkStatusResult.innerHTML = '<div class="alert error">Invalid response format</div>';
      return;
    }
    
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Order ID</th>
          <th>Status</th>
          <th>Charge</th>
          <th>Start Count</th>
          <th>Remains</th>
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
}