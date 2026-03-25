import React, { createContext, useContext, useState, useEffect } from 'react';

// INTERFACE UTILISATEUR
interface User { 
  id: string; 
  email: string;
  firstName: string;
  lastName: string;
  roles: string[]; 
} 

// INTERFACE DU CONTEXTE
interface AuthContextType { 
  user: User | null;
  token: string | null; 
  isAuthenticated: boolean; 
  login: (token: string, userData: User) => void; 
  logout: () => void; 
  isLoading: boolean;
}
// Création du Contexte (Valeur par défaut indéfinie)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Composant Fournisseur d'Authentification, encapsule l'application pour diffuser l'état de connexion à tous les composants
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null); // État Utilisateur
  const [token, setToken] = useState<string | null>(null); // État Token JWT
  const [isLoading, setIsLoading] = useState(true); // État Chargement (Lecture localStorage)

  // Effet de démarrage : Hydratation (Restauration) de la session automatique
  useEffect(() => {
    // Tente de lire les informations sauvegardées dans le navigateur
    const storedToken = localStorage.getItem('token');
    const storedUser  = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
      }
    }
    setIsLoading(false);
  }, []); // [] = S'exécute UNE seule fois au montage du composant

  // Déclenche la phase de connexion, sauvegarde les données en mémoire vive (State) ET en mémoire morte (LocalStorage)
  const login = (newToken: string, userData: User) => {
    setToken(newToken); 
    setUser(userData);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
  }; 

  // Déconnecte l'utilisateur, vide les caches mémoires et supprime les clés du navigateur
  const logout = () => {
    setToken(null); // Reset State
    setUser(null); // Reset State
    localStorage.removeItem('token'); // Efface token
    localStorage.removeItem('user'); // Efface user
    localStorage.removeItem('refresh_token'); // Efface refresh token
  };
  return (
    // Diffuse les états et les fonctions via la value du Provider
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout, isLoading }}>
      {}
      {!isLoading && children} 
    </AuthContext.Provider>
  );
}; 

// Hook personnalisé pour consommer facilement l'Authentification, évite d'importer useContext(AuthContext) partout
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
