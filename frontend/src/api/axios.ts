import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// LOGIQUE DE ROTATION DE TOKEN (Refresh Token Queue)
// Prévention des appels parallèles de Refresh qui invalideraient des tokens
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

/**
 * Débloque la file d'attente une fois le Refresh terminé.
 */
const processQueue = (error: unknown, token: string | null = null) => { 
  failedQueue.forEach((prom) => { 
    if (error) prom.reject(error);
    else prom.resolve(token!);
  }); 
  failedQueue = [];
};

// INTERCEPTEUR DE RÉPONSE (Response Interceptor)
// But : Traiter les erreurs 401 (Expire) et tenter une reconnexion transparente
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    // Condition : 401 Unauthorized ET ce n'est pas déjà une tentative de Retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // CAS 1 : Un Refresh est déjà en cours par une autre requête parallèle
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true; 
      isRefreshing = true;
      const currentRefreshToken = localStorage.getItem('refresh_token');
      
      if (!currentRefreshToken) { // Si pas de jeton de secours
        processQueue(new Error('No refresh token'), null); // Annule la file
        // Déconnexion forcée du client
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login'; // Redirection
        return Promise.reject(error);
      }

      try { 
        // Appel direct via la racine d'Axios (Pas via 'api' pour éviter l'intercepteur de boucle)
        const refreshResponse = await axios.post('http://localhost:8000/api/auth/refresh', {
          refresh_token: currentRefreshToken, // Body JSON requis par le bundle Symfony
        });

        const newToken: string        = refreshResponse.data.token;
        const newRefreshToken: string = refreshResponse.data.refresh_token;
        
        localStorage.setItem('token', newToken);
        if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken); 
        
        // Actualise pour les futures requêtes de l'application
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`; 
        
        processQueue(null, newToken); // Réveille toute la file d'attente en succès

        // Rejoue la requête originale qui avait provoqué le 401
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
        
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Purge totale de la session local
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login'; // Redirection Login Page
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      } 
    }
    return Promise.reject(error);
  }
);

export default api;
