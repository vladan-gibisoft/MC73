/**
 * Authentication Module for MC73 Generator Uplatnica
 * Handles login, logout, and session management
 */

// Current user data
let currentUser = null;

/**
 * Get current user data
 */
function getCurrentUser() {
  return currentUser;
}

/**
 * Check if current user is admin
 */
function isAdmin() {
  return currentUser && currentUser.is_admin;
}

/**
 * Initialize auth state
 * Call this on page load to check authentication
 */
async function initAuth() {
  if (!isAuthenticated()) {
    // Not authenticated, redirect to login (except on login page)
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = '/login.html';
    }
    return false;
  }

  try {
    // Verify token and get user data
    const response = await api.auth.me();
    currentUser = response.user;
    return true;
  } catch (err) {
    console.error('Auth check failed:', err);
    removeToken();
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = '/login.html';
    }
    return false;
  }
}

/**
 * Login user
 * @param {string} email - User email
 * @param {string} password - User password
 */
async function login(email, password) {
  const response = await api.auth.login(email, password);

  // Store token
  setToken(response.token);

  // Store user data
  currentUser = response.user;

  return response.user;
}

/**
 * Logout user
 */
async function logout() {
  try {
    await api.auth.logout();
  } catch (err) {
    console.error('Logout error:', err);
  }

  // Clear local data
  removeToken();
  currentUser = null;

  // Redirect to login
  window.location.href = '/login.html';
}

/**
 * Require authentication
 * Redirects to login if not authenticated
 */
async function requireAuth() {
  const isAuth = await initAuth();
  if (!isAuth) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

/**
 * Require admin role
 * Redirects to dashboard if not admin
 */
async function requireAdmin() {
  const isAuth = await requireAuth();
  if (!isAuth) return false;

  if (!isAdmin()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

/**
 * Update navigation based on user role
 */
function updateNavigation() {
  if (!currentUser) return;

  // Update user info display
  const userNameEl = document.querySelector('.user-name');
  const userEmailEl = document.querySelector('.user-email');
  const userRoleEl = document.querySelector('.user-role');

  if (userNameEl) userNameEl.textContent = currentUser.name;
  if (userEmailEl) userEmailEl.textContent = currentUser.email;
  if (userRoleEl) {
    const roles = [];
    if (currentUser.is_admin) roles.push('Administrator');
    if (currentUser.is_user) roles.push('Korisnik');
    userRoleEl.innerHTML = roles.map(r => `<span class="badge badge-info">${r}</span>`).join(' ');
  }

  // Show/hide admin-only navigation items
  const adminOnlyItems = document.querySelectorAll('.admin-only');
  adminOnlyItems.forEach(item => {
    item.style.display = currentUser.is_admin ? '' : 'none';
  });

  // Show/hide user-only navigation items
  const userOnlyItems = document.querySelectorAll('.user-only');
  userOnlyItems.forEach(item => {
    item.style.display = currentUser.is_user ? '' : 'none';
  });
}

/**
 * Handle login form submission
 */
async function handleLogin(event) {
  event.preventDefault();

  const form = event.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  const errorEl = document.getElementById('login-error');
  const submitBtn = form.querySelector('button[type="submit"]');

  // Clear previous error
  if (errorEl) errorEl.textContent = '';

  // Disable button during login
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Prijavljivanje...';
  }

  try {
    await login(email, password);

    // Redirect to dashboard
    window.location.href = '/index.html';

  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Greska prilikom prijave';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Prijava';
    }
  }
}

// Export for use in other scripts
window.getCurrentUser = getCurrentUser;
window.isAdmin = isAdmin;
window.initAuth = initAuth;
window.login = login;
window.logout = logout;
window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;
window.updateNavigation = updateNavigation;
window.handleLogin = handleLogin;
