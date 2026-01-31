/**
 * API Client for MC73 Generator Uplatnica
 * Handles all communication with backend API
 */

// Auto-detect API URL based on environment
const API_BASE_URL = (() => {
  const hostname = window.location.hostname;

  // Local development
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:8787/api";
  }

  // Production (Cloudflare)
  return "https://mc73-api.gibisoft.workers.dev/api";
})();

/**
 * Get stored JWT token
 */
function getToken() {
  return localStorage.getItem("token");
}

/**
 * Store JWT token
 */
function setToken(token) {
  localStorage.setItem("token", token);
}

/**
 * Remove JWT token
 */
function removeToken() {
  localStorage.removeItem("token");
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return !!getToken();
}

/**
 * Make API request with authentication
 * @param {string} endpoint - API endpoint (without /api prefix)
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response data
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Add auth token if available
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized
  if (response.status === 401) {
    removeToken();
    window.location.href = "/login.html";
    throw new Error("Sesija je istekla. Prijavite se ponovo.");
  }

  // Parse response
  const contentType = response.headers.get("content-type");

  if (contentType && contentType.includes("application/json")) {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Greska na serveru");
    }

    return data;
  }

  // Handle non-JSON responses (like PDF)
  if (!response.ok) {
    throw new Error("Greska na serveru");
  }

  return response;
}

/**
 * GET request
 */
async function get(endpoint) {
  return apiRequest(endpoint, { method: "GET" });
}

/**
 * POST request
 */
async function post(endpoint, data) {
  return apiRequest(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * PUT request
 */
async function put(endpoint, data) {
  return apiRequest(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * DELETE request
 */
async function del(endpoint) {
  return apiRequest(endpoint, { method: "DELETE" });
}

/**
 * Download file (PDF)
 */
async function downloadFile(endpoint, filename) {
  const url = `${API_BASE_URL}${endpoint}`;

  const token = getToken();
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Greska prilikom preuzimanja" }));
    throw new Error(error.error);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(downloadUrl);
}

// API Methods

const api = {
  // Auth
  auth: {
    login: (email, password) => post("/auth/login", { email, password }),
    logout: () => post("/auth/logout", {}),
    me: () => get("/auth/me"),
  },

  // Building
  building: {
    get: () => get("/building"),
    update: (data) => put("/building", data),
  },

  // Apartments
  apartments: {
    list: () => get("/apartments"),
    get: (id) => get(`/apartments/${id}`),
    create: (data) => post("/apartments", data),
    update: (id, data) => put(`/apartments/${id}`, data),
    delete: (id) => del(`/apartments/${id}`),
  },

  // Users
  users: {
    list: () => get("/users"),
    get: (id) => get(`/users/${id}`),
    create: (data) => post("/users", data),
    update: (id, data) => put(`/users/${id}`, data),
    delete: (id) => del(`/users/${id}`),
  },

  // Billings
  billings: {
    list: (year, month) => {
      let endpoint = "/billings";
      if (year && month) {
        endpoint += `?year=${year}&month=${month}`;
      }
      return get(endpoint);
    },
    generate: (year, month) => post("/billings/generate", { year, month }),
    delete: (year, month) => del(`/billings/${year}/${month}`),
    downloadPDF: (year, month) => {
      const filename = `uplatnice_${year}_${String(month).padStart(2, "0")}.pdf`;
      return downloadFile(`/billings/pdf/${year}/${month}`, filename);
    },
    getMonths: () => get("/billings/months"),
  },

  // Payments
  payments: {
    list: () => get("/payments"),
    create: (data) => post("/payments", data),
    delete: (id) => del(`/payments/${id}`),
    getBalance: (apartmentId) => get(`/payments/balance/${apartmentId}`),
    getAllBalances: () => get("/payments/balances"),
    getHistory: (apartmentId) => get(`/payments/history/${apartmentId}`),
  },
};

// Export for use in other scripts
window.api = api;
window.getToken = getToken;
window.setToken = setToken;
window.removeToken = removeToken;
window.isAuthenticated = isAuthenticated;
