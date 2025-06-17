// File ini berisi fungsi-fungsi tambahan untuk pembayaran
// (Bisa digunakan untuk ekstensi fungsionalitas pembayaran di masa depan)

/**
 * Format nominal uang ke format Rupiah
 * @param {number} amount - Jumlah uang
 * @returns {string} - String yang sudah diformat
 */
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

/**
 * Validasi URL
 * @param {string} url - URL yang akan divalidasi
 * @returns {boolean} - true jika valid, false jika tidak
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Menghitung estimasi waktu selesai order berdasarkan jumlah
 * @param {number} quantity - Jumlah order
 * @returns {string} - Estimasi waktu
 */
function calculateEstimateTime(quantity) {
  if (quantity < 100) return '1-2 jam';
  if (quantity < 1000) return '3-6 jam';
  if (quantity < 5000) return '6-12 jam';
  return '12-24 jam';
}

// Ekspor fungsi jika diperlukan
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatRupiah,
    isValidUrl,
    calculateEstimateTime
  };
}