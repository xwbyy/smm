document.addEventListener('DOMContentLoaded', function() {
  const serviceSelect = document.getElementById('service-select');
  const serviceDetails = document.getElementById('service-details');
  const orderForm = document.getElementById('order-form');
  const quantityInput = document.getElementById('quantity');
  const quantityRange = document.getElementById('quantity-range');
  const paymentSection = document.getElementById('payment-section');
  const orderSummary = document.getElementById('order-summary');
  
  let services = [];
  let currentOrder = null;

  // Memuat layanan dari API
  fetch('/api/services')
    .then(response => response.json())
    .then(data => {
      services = data;
      renderServiceOptions();
    })
    .catch(error => {
      console.error('Error loading services:', error);
      serviceSelect.innerHTML = '<option value="">Gagal memuat layanan</option>';
    });

  // Render pilihan layanan
  function renderServiceOptions() {
    serviceSelect.innerHTML = '<option value="">Pilih layanan...</option>';
    
    services.forEach(service => {
      const option = document.createElement('option');
      option.value = service.service;
      option.textContent = `${service.name} (Rp${service.rate}/item)`;
      serviceSelect.appendChild(option);
    });
  }

  // Menampilkan detail layanan yang dipilih
  serviceSelect.addEventListener('change', function() {
    const selectedServiceId = parseInt(this.value);
    const service = services.find(s => s.service === selectedServiceId);
    
    if (service) {
      serviceDetails.innerHTML = `
        <h3>${service.name}</h3>
        <p><strong>Kategori:</strong> ${service.category}</p>
        <p><strong>Harga:</strong> Rp${service.rate} per item</p>
        <p><strong>Jumlah minimal:</strong> ${service.min}</p>
        <p><strong>Jumlah maksimal:</strong> ${service.max}</p>
        <p><strong>Refill:</strong> ${service.refill ? 'Tersedia' : 'Tidak tersedia'}</p>
        <p><strong>Pembatalan:</strong> ${service.cancel ? 'Diizinkan' : 'Tidak diizinkan'}</p>
      `;
      
      quantityInput.min = service.min;
      quantityInput.max = service.max;
      quantityRange.textContent = `(Min: ${service.min}, Max: ${service.max})`;
    } else {
      serviceDetails.innerHTML = '';
      quantityRange.textContent = '';
    }
  });

  // Handle form order
  orderForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const serviceId = serviceSelect.value;
    const link = document.getElementById('link').value;
    const quantity = quantityInput.value;
    
    if (!serviceId || !link || !quantity) {
      alert('Harap isi semua field!');
      return;
    }
    
    const orderBtn = document.getElementById('order-btn');
    orderBtn.disabled = true;
    orderBtn.textContent = 'Memproses...';
    
    // Kirim order ke server
    fetch('/api/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service: serviceId,
        link,
        quantity
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        currentOrder = {
          orderId: data.orderId,
          service: services.find(s => s.service === parseInt(serviceId)),
          link,
          quantity,
          amount: calculateAmount(parseInt(serviceId), parseInt(quantity))
        };
        
        showPaymentSection();
        initPaymentProcess();
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
      orderBtn.textContent = 'Buat Pesanan';
    });
  });

  // Hitung jumlah pembayaran
  function calculateAmount(serviceId, quantity) {
    const service = services.find(s => s.service === serviceId);
    if (!service) return 0;
    
    const rate = parseFloat(service.rate);
    return Math.ceil(rate * quantity * 1000); // Convert to Rupiah (asumsi rate dalam ribuan)
  }

  // Tampilkan section pembayaran
  function showPaymentSection() {
    paymentSection.classList.remove('hidden');
    
    // Scroll ke section pembayaran
    paymentSection.scrollIntoView({ behavior: 'smooth' });
    
    // Tampilkan ringkasan order
    orderSummary.innerHTML = `
      <h3>Ringkasan Pesanan</h3>
      <p><strong>Layanan:</strong> ${currentOrder.service.name}</p>
      <p><strong>Link Target:</strong> ${currentOrder.link}</p>
      <p><strong>Jumlah:</strong> ${currentOrder.quantity}</p>
      <p><strong>Total Pembayaran:</strong> Rp${currentOrder.amount.toLocaleString('id-ID')}</p>
    `;
  }
});

// Fungsi untuk memformat angka ke Rupiah
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}