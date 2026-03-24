import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout'; 
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import MyTickets from './pages/MyTickets';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import EventDetail from './pages/EventDetail';
import TicketDetail from './pages/TicketDetail'; 
import { useAuth } from './context/AuthContext';


// Route Protégée : Exige d'être connecté, sinon, redirige vers /login
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth(); 
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />; 
};

// Route Organisateur/Admin : Exige d'avoir le rôle EVENT_CREATOR ou ADMIN, sinon, redirige vers l'accueil
const OrganizerRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuth(); // Récupère user et auth
  
  if (!isAuthenticated) return <Navigate to="/login" replace />; // Non connecté
  
  // Vérifie la présence d'un des deux rôles dans le tableau de l'utilisateur
  if (!user?.roles?.includes('ROLE_EVENT_CREATOR') && !user?.roles?.includes('ROLE_ADMIN')) { 
    return <Navigate to="/" replace />; 
  }
  return <>{children}</>;
};

// Route Visiteur (Guest) : Interdit d'être connecté, utile pour Login/Register (Évite d'y retourner si déjà loggué)
const GuestRoute = ({ children }: { children: React.ReactNode }) => { 
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>; // Redirige vers accueil si logué
};

// APPLICATION PRINCIPALE 
function App() {
  return ( // Rendu
    <Router> {/* Wrapper d'historique de navigation du navigateur */}
      <Routes> {/* Conteneur de routes Express-like */}
        
        {/* Route Racine "/" utilisant le Layout principal (Navbar + Footer + Outlet) */}
        <Route path="/" element={<AppLayout />}> 
          
          {/* ROUTES PUBLIQUES (Tout le monde voit) */}
          <Route index element={<Home />} /> {/* Route par défaut "/" -> Home */}
          <Route path="events" element={<Home />} /> {/* Alias "/events" */}
          <Route path="events/:id" element={<EventDetail />} /> {/* Détail dynamique */}

          {/* ROUTES VISITEURS UNIQUEMENT (Login/Register) */}
          <Route path="login"    element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="register" element={<GuestRoute><Register /></GuestRoute>} />

          {/* ROUTES PROTÉGÉES (Utilisateur normal) */}
          <Route path="profile"    element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="my-tickets" element={<ProtectedRoute><MyTickets /></ProtectedRoute>} />
          <Route path="tickets/:id" element={<ProtectedRoute><TicketDetail /></ProtectedRoute>} />

          {/* ROUTES ORGANISATEURS ET ADMINS */}
          <Route path="dashboard" element={<OrganizerRoute><Dashboard /></OrganizerRoute>} />

          {/* FALLBACK (Page 404 de secours) */}
          <Route path="*" element={<Navigate to="/" replace />} /> {/* Redirection globale */}
        </Route> {/* Fin Route Layout */}

      </Routes> {/* Fin Conteneur Routes */}
    </Router> // Fin Router
  ); 
} 

export default App;
