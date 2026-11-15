/**
 * TERRA-X / EARTH ANALOGS
 * Client-Side Authentication Module (Database-Free)
 * 
 * Manages user sessions, credentials, and access guards for the
 * Planetary Intelligence & Analog Research Dashboard.
 */

const SESSION_KEY = "terra_x_session";
const USERS_KEY = "terra_x_users";

// Built-in verified research accounts (default offline accounts)
const DEFAULT_USERS = [
  {
    username: "analyst",
    password: "earth-analogs",
    name: "Dr. Sarah Chen",
    role: "Lead Astrobiologist & Mission Specialist",
    clearance: "Level 3 • Planetary Exploration",
    avatar: "SC"
  },
  {
    username: "admin",
    password: "nasa2026",
    name: "Commander M. Jadir",
    role: "Chief Planetary Exploration Director",
    clearance: "Level 4 • Director Clearance",
    avatar: "MJ"
  },
  {
    username: "nasa",
    password: "moon-and-mars",
    name: "Alex Vance",
    role: "Autonomous Rover & Terrain Analyst",
    clearance: "Level 2 • Flight Instrumentation",
    avatar: "AV"
  }
];

/**
 * Retrieve registered users from localStorage, seeded with defaults.
 */
export function getRegisteredUsers() {
  try {
    const stored = localStorage.getItem(USERS_KEY);
    if (!stored) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    return parsed;
  } catch (e) {
    console.warn("Storage access failed, using in-memory defaults", e);
    return DEFAULT_USERS;
  }
}

/**
 * Register a new user without database (persists in localStorage).
 */
export function registerUser(username, password, name = "", role = "") {
  const cleanUser = String(username).trim().toLowerCase();
  const cleanPass = String(password).trim();

  if (!cleanUser || cleanUser.length < 3) {
    return { success: false, error: "Username must be at least 3 characters." };
  }
  if (!cleanPass || cleanPass.length < 4) {
    return { success: false, error: "Password must be at least 4 characters." };
  }

  const users = getRegisteredUsers();
  if (users.some((u) => u.username === cleanUser)) {
    return { success: false, error: `Username "${cleanUser}" is already registered. Please sign in or use another username.` };
  }

  const displayName = name.trim() || `Analyst ${cleanUser.toUpperCase()}`;
  const displayRole = role.trim() || "Planetary Field Specialist";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const newUser = {
    username: cleanUser,
    password: cleanPass,
    name: displayName,
    role: displayRole,
    clearance: "Level 2 • Field Research",
    avatar: initials || "PA",
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error("Failed to save user", e);
  }

  return { success: true, user: newUser };
}

/**
 * Authenticate credentials and store active session.
 */
export function login(username, password, remember = true) {
  const cleanUser = String(username).trim().toLowerCase();
  const cleanPass = String(password).trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, error: "Please enter both username and password." };
  }

  const users = getRegisteredUsers();
  const match = users.find(
    (u) => u.username === cleanUser && u.password === cleanPass
  );

  if (!match) {
    return {
      success: false,
      error: "Invalid credentials. Use demo credentials (analyst / earth-analogs) or create an account."
    };
  }

  const session = {
    username: match.username,
    name: match.name,
    role: match.role,
    clearance: match.clearance,
    avatar: match.avatar,
    token: "tx_sess_" + Math.random().toString(36).substring(2) + Date.now().toString(36),
    loginTime: new Date().toISOString()
  };

  try {
    if (remember) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.removeItem(SESSION_KEY);
    }
  } catch (e) {
    console.warn("Storage save error", e);
  }

  return { success: true, user: session };
}

/**
 * Check if the active session is valid.
 */
export function isAuthenticated() {
  return getCurrentUser() !== null;
}

/**
 * Retrieve currently logged-in user profile or null.
 */
export function getCurrentUser() {
  try {
    const local = localStorage.getItem(SESSION_KEY);
    if (local) return JSON.parse(local);

    const session = sessionStorage.getItem(SESSION_KEY);
    if (session) return JSON.parse(session);
  } catch (e) {
    console.warn("Error reading session", e);
  }
  return null;
}

/**
 * Terminate user session and redirect to login.
 */
export function logout() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.warn("Error removing session", e);
  }
  window.location.href = "/login.html?logged_out=1";
}

/**
 * Route protection: Call at top of dashboard pages.
 * Redirects unauthenticated users to /login.html.
 */
export function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/login.html?redirect=${currentPath}`);
    return null;
  }
  return user;
}
