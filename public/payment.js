document.addEventListener('DOMContentLoaded', function() {
  // This file would contain payment-specific functionality if needed
  // Currently all payment information is static in the HTML
  
  // Example: Copy payment address to clipboard
  document.querySelectorAll('.payment-address').forEach(address => {
    address.addEventListener('click', function() {
      const textToCopy = this.textContent;
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          const originalText = this.textContent;
          this.textContent = 'Copied!';
          setTimeout(() => {
            this.textContent = originalText;
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
        });
    });
    
    // Add cursor pointer to indicate it's clickable
    address.style.cursor = 'pointer';
  });
});