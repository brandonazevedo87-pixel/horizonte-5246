import { createAuthClient } from 'better-auth/react';

const key = 'horizonte.session';
export const getToken = () => sessionStorage.getItem(key);
export const clearToken = () => sessionStorage.removeItem(key);

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/auth',
  fetchOptions: {
    auth: { type: 'Bearer', token: () => getToken() ?? undefined },
    onSuccess: ({ response }) => {
      const token = response.headers.get('set-auth-token');
      if (token) sessionStorage.setItem(key, token);
    },
  },
});
