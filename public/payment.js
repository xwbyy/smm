// Helper functions untuk pembayaran

/**
 * Format waktu countdown
 * @param {string} expiryTime - Waktu kadaluarsa (format dari API)
 * @returns {string} - String countdown
 */
function formatCountdown(expiryTime) {
  const now = new Date();
  const expiry = new Date(expiryTime);
  const diff = expiry - now;
  
  if (diff <= 0) return 'Waktu habis';
  
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return `${minutes} menit ${seconds} detik`;
}

/**
 * Validasi URL
 * @param {string} url - URL untuk divalidasi
 * @returns {boolean} - True jika valid
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format angka ke Rupiah
 * @param {number} amount - Jumlah uang
 * @returns {string} - Format Rupiah
 */
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

// Ekspor fungsi jika diperlukan
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatCountdown,
    isValidUrl,
    formatRupiah
  };
}