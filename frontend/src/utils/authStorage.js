const TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refreshToken';

export const getAccessToken = () => sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);

export const getRefreshToken = () => sessionStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY);

const getActiveStorage = () => {
  if (localStorage.getItem(TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY)) {
    return localStorage;
  }

  if (sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY)) {
    return sessionStorage;
  }

  return null;
};

export const setAuthTokens = (accessToken, refreshToken, remember = false) => {
  const primaryStorage = remember ? localStorage : sessionStorage;
  const secondaryStorage = remember ? sessionStorage : localStorage;

  if (accessToken) {
    primaryStorage.setItem(TOKEN_KEY, accessToken);
  } else {
    primaryStorage.removeItem(TOKEN_KEY);
  }

  if (refreshToken) {
    primaryStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    primaryStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  secondaryStorage.removeItem(TOKEN_KEY);
  secondaryStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const updateAuthTokens = (accessToken, refreshToken) => {
  const activeStorage = getActiveStorage() || sessionStorage;
  const inactiveStorage = activeStorage === localStorage ? sessionStorage : localStorage;

  if (accessToken) {
    activeStorage.setItem(TOKEN_KEY, accessToken);
  }

  if (refreshToken) {
    activeStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  inactiveStorage.removeItem(TOKEN_KEY);
  inactiveStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const setAccessToken = (token, remember = false) => {
  setAuthTokens(token, null, remember);
};

export const clearAuthTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const clearAccessToken = clearAuthTokens;
