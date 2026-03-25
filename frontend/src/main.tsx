import React from 'react'; 
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';

// Initialisation du point d'entrée React sur l'élément HTML <div id="root">
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode> {/* Active des vérifications supplémentaires en cours de dév */}
    <AuthProvider> {/* Encapsule l'application pour de l'Auth global */}
      <App /> {/* Composant Principal contenant le Router */}
    </AuthProvider>
  </React.StrictMode>
);
