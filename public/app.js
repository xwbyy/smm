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
  
  // API key handling
  const apiKeyInput = document.getElementById('api-key');
  const saveKeyBtn = document.getElementById('save-key');
  
  // Load saved API key if exists
  const savedApiKey = localStorage.getItem('smmPanelApiKey');
  if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
    // Load initial data if we have an API key
    loadBalance();
    loadServices();
    loadOrders();
  }
  
  // Save API key
  saveKeyBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      localStorage.setItem('smmPanelApiKey', apiKey);
      alert('API key saved successfully!');
      // Reload data with new key
      loadBalance();
      loadServices();
      loadOrders();
    } else {
      alert('Please enter a valid API key');
    }
  });
  
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
  
  // Initial data loading
  if (savedApiKey) {
    loadBalance();
    loadServices();
    loadOrders();
    populateServiceDropdown();
  }
  
  // Functions
  function getApiKey() {
    return localStorage.getItem('smmPanelApiKey');
  }
  
  function showError(message) {
    alert('Error: ' + message);
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
          `${data.balance} ${data.currency}`;
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
    servicesList.innerHTML = '<div class="loading">Loading services...</div>';
    
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
      servicesList.innerHTML = '<div class="no-results">No services found</div>';
      return;
    }
    
    let html = '';
    
    services.forEach(service => {
      html += `
        <div class="service-card" data-category="${service.category}">
          <h3>${service.name}</h3>
          <div class="service-meta">
            <span class="service-type">${service.type}</span>
            <span class="service-price">$${service.rate} per 1000</span>
          </div>
          <div class="service-minmax">Min: ${service.min} - Max: ${service.max}</div>
          <div class="service-actions">
            <button class="order-btn" data-service-id="${service.service}" 
              data-rate="${service.rate}" data-min="${service.min}" data-max="${service.max}">
              Order Now
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
        document.getElementById('quantity-range').textContent = `Min: ${min} - Max: ${max}`;
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
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    
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
    ordersList.innerHTML = '<div class="loading">Loading orders...</div>';
    
    // In a real app, you would fetch actual orders from the API
    // For now, we'll simulate it with a timeout
    setTimeout(() => {
      ordersList.innerHTML = `
        <div class="order-card">
          <div class="order-info">
            <h3>Instagram Followers</h3>
            <div class="order-meta">
              <span>Order #23501</span>
              <span>Quantity: 1000</span>
              <span>Price: $0.90</span>
            </div>
            <div class="order-status status-in-progress">In Progress</div>
          </div>
          <div class="order-actions">
            <button class="action-btn refill-btn">Refill</button>
            <button class="action-btn cancel-btn">Cancel</button>
            <button class="action-btn details-btn">Details</button>
          </div>
        </div>
        <div class="order-card">
          <div class="order-info">
            <h3>YouTube Views</h3>
            <div class="order-meta">
              <span>Order #23498</span>
              <span>Quantity: 5000</span>
              <span>Price: $5.00</span>
            </div>
            <div class="order-status status-completed">Completed</div>
          </div>
          <div class="order-actions">
            <button class="action-btn details-btn">Details</button>
          </div>
        </div>
      `;
      
      // Add event listeners to order action buttons
      document.querySelectorAll('.details-btn').forEach(button => {
        button.addEventListener('click', showOrderDetails);
      });
      
      document.querySelectorAll('.refill-btn').forEach(button => {
        button.addEventListener('click', () => {
          alert('Refill functionality would be implemented here');
        });
      });
      
      document.querySelectorAll('.cancel-btn').forEach(button => {
        button.addEventListener('click', () => {
          alert('Cancel functionality would be implemented here');
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
        <h4>Order Information</h4>
        <p><strong>Service:</strong> Instagram Followers</p>
        <p><strong>Order ID:</strong> 23501</p>
        <p><strong>Link:</strong> https://instagram.com/username</p>
        <p><strong>Quantity:</strong> 1000</p>
        <p><strong>Price:</strong> $0.90</p>
        <p><strong>Status:</strong> In Progress</p>
        <p><strong>Start Count:</strong> 3572</p>
        <p><strong>Remains:</strong> 157</p>
      </div>
    `;
    
    modal.style.display = 'flex';
  }
  
  function populateServiceDropdown() {
    const apiKey = getApiKey();
    if (!apiKey) return;
    
    const serviceSelect = document.getElementById('service-select');
    serviceSelect.innerHTML = '<option value="">Select a service</option>';
    
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
          option.textContent = `${service.name} ($${service.rate} per 1000)`;
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
    
    document.getElementById('quantity-range').textContent = `Min: ${min} - Max: ${max}`;
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
      document.getElementById('estimated-price').textContent = '$0.00';
      return;
    }
    
    const rate = parseFloat(selectedOption.getAttribute('data-rate'));
    const quantity = parseInt(document.getElementById('service-quantity').value) || 0;
    
    const price = (rate * quantity / 1000).toFixed(2);
    document.getElementById('estimated-price').textContent = `$${price}`;
  }
  
  function placeOrder(e) {
    e.preventDefault();
    
    const apiKey = getApiKey();
    if (!apiKey) {
      showError('Please save your API key first');
      return;
    }
    
    const serviceId = document.getElementById('service-select').value;
    const link = document.getElementById('service-link').value;
    const quantity = document.getElementById('service-quantity').value;
    const runs = document.getElementById('service-runs').value;
    const interval = document.getElementById('service-interval').value;
    
    if (!serviceId || !link || !quantity) {
      showError('Please fill in all required fields');
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
        alert(`Order placed successfully! Order ID: ${data.order}`);
        // Reset form
        document.getElementById('order-form').reset();
        document.getElementById('estimated-price').textContent = '$0.00';
        // Switch to orders tab
        document.querySelector('nav li[data-tab="orders"]').click();
        // Refresh orders list
        loadOrders();
      }
    })
    .catch(error => {
      showError(error.message);
    });
  }
});