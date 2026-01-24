/**
 * Main Application Module for MC73 Generator Uplatnica
 * Shared UI functions and utilities
 */

/**
 * Format currency (RSD)
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('sr-RS', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount) + ' RSD';
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('sr-RS');
}

/**
 * Format date for input field
 */
function formatDateForInput(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

/**
 * Format Serbian bank account
 * Short format -> XXX-XXXXXXXXXXXXX-XX
 */
function formatBankAccount(input) {
  if (!input) return '';

  // Remove any non-digit characters
  const digits = input.replace(/\D/g, '');

  if (digits.length === 18) {
    // Already full format
    return `${digits.slice(0, 3)}-${digits.slice(3, 16)}-${digits.slice(16, 18)}`;
  }

  if (digits.length >= 7 && digits.length < 18) {
    // Short format
    const bank = digits.slice(0, 3);
    const control = digits.slice(-2);
    const account = digits.slice(3, -2).padStart(13, '0');
    return `${bank}-${account}-${control}`;
  }

  return input; // Return as-is if invalid
}

/**
 * Show loading state on element
 */
function showLoading(element, message = 'Ucitavanje...') {
  if (!element) return;
  element.innerHTML = `
    <div class="loading">
      <span class="spinner"></span>
      <span>${message}</span>
    </div>
  `;
}

/**
 * Show empty state
 */
function showEmpty(element, message = 'Nema podataka') {
  if (!element) return;
  element.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">&#128466;</div>
      <div class="empty-state-title">${message}</div>
    </div>
  `;
}

/**
 * Show error message
 */
function showError(element, message) {
  if (!element) return;
  element.innerHTML = `<div class="alert alert-danger">${message}</div>`;
}

/**
 * Show success message
 */
function showSuccess(element, message) {
  if (!element) return;
  element.innerHTML = `<div class="alert alert-success">${message}</div>`;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
    document.body.appendChild(container);
  }

  // Create toast
  const toast = document.createElement('div');
  toast.className = `alert alert-${type}`;
  toast.style.cssText = 'margin-bottom: 10px; min-width: 250px; animation: fadeIn 0.3s;';
  toast.textContent = message;

  container.appendChild(toast);

  // Remove after 5 seconds
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}


/**
 * Open modal
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Close modal
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/**
 * Close modal on overlay click
 */
function setupModalClose() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });
}

/**
 * Setup mobile menu toggle
 */
function setupMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');

  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
}

/**
 * Set active navigation item
 */
function setActiveNav() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (href !== '/index.html' && currentPath.includes(href))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/**
 * Setup bank account field auto-formatting
 */
function setupBankAccountField(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener('blur', () => {
    if (input.value) {
      input.value = formatBankAccount(input.value);
    }
  });
}

/**
 * Get month name in Serbian
 */
function getMonthName(month) {
  const months = [
    'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
    'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
  ];
  return months[month - 1] || '';
}

/**
 * Generate month/year options
 */
function generateMonthOptions(selectId, startYear = 2024) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Clear existing options except first (placeholder)
  while (select.options.length > 1) {
    select.remove(1);
  }

  // Add options for each month from current to start
  for (let year = currentYear; year >= startYear; year--) {
    const maxMonth = year === currentYear ? currentMonth : 12;
    for (let month = maxMonth; month >= 1; month--) {
      const option = document.createElement('option');
      option.value = `${year}-${month}`;
      option.textContent = `${getMonthName(month)} ${year}`;
      select.appendChild(option);
    }
  }
}

/**
 * Initialize common page elements
 */
async function initPage(requireAdminAccess = false) {
  // Check authentication
  if (requireAdminAccess) {
    const isAuth = await requireAdmin();
    if (!isAuth) return false;
  } else {
    const isAuth = await requireAuth();
    if (!isAuth) return false;
  }

  // Update navigation
  updateNavigation();
  setActiveNav();

  // Setup UI elements
  setupMobileMenu();
  setupModalClose();

  return true;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Export for use in other scripts
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatDateForInput = formatDateForInput;
window.formatBankAccount = formatBankAccount;
window.showLoading = showLoading;
window.showEmpty = showEmpty;
window.showError = showError;
window.showSuccess = showSuccess;
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.setupModalClose = setupModalClose;
window.setupMobileMenu = setupMobileMenu;
window.setActiveNav = setActiveNav;
window.setupBankAccountField = setupBankAccountField;
window.getMonthName = getMonthName;
window.generateMonthOptions = generateMonthOptions;
window.initPage = initPage;
window.escapeHtml = escapeHtml;
window.debounce = debounce;
