import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Ticket, LogOut, Menu, X, LayoutDashboard, Receipt } from 'lucide-react'; 

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);

  /**
   * Déclenche la déconnexion et force une redirection racine.
   */
  const handleLogout = () => {
    logout(); 
    window.location.replace('/');
  };

  // Raccourci pour savoir si l'utilisateur est un organisateur ou un admin
  const isOrganizer = user?.roles?.includes('ROLE_EVENT_CREATOR') || user?.roles?.includes('ROLE_ADMIN');

  /**
   * Génère les classes CSS dynamiques pour les liens NavLink (Actif / Inactif).
   * Utilise des pseudos-éléments 'after' pour l'effet de soulignement animé.
   */
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `relative text-sm font-sans font-medium transition-colors duration-200 py-1
     after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-sol
     after:transition-all after:duration-300 hover:after:w-full
     ${isActive ? 'text-sol after:w-full' : 'text-noir-200 hover:text-noir-50'}`;

  return ( 
    // Barre collante (sticky) avec effet de flou backdrop-blur-xl
    <nav className="sticky top-0 z-50 bg-noir-950/90 backdrop-blur-xl border-b border-noir-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* BLOC LOGO */}
          <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
            {/* Carré logo jaune ambré avec ombre brillante */}
            <div className="w-8 h-8 bg-sol rounded-sm flex items-center justify-center shadow-[0_0_12px_rgba(232,167,48,0.3)] group-hover:shadow-[0_0_20px_rgba(232,167,48,0.5)] transition-shadow duration-300">
              <Ticket className="w-4 h-4 text-noir-950" /> {/* Icône Ticket */}
            </div>
            <span className="font-display font-semibold text-lg text-noir-50 group-hover:text-sol transition-colors duration-200 hidden sm:block">
              TicketSaaS
            </span>
          </Link>

          {/* NAVIGATION DESKTOP */}
          <div className="hidden sm:flex items-center gap-8">
            <NavLink to="/events" className={navLinkClass}>
              Explorer
            </NavLink>

            {/* Onglet privé : Mes billets */}
            {isAuthenticated && (
              <NavLink to="/my-tickets" className={navLinkClass}>
                Mes billets
              </NavLink>
            )}

            {/* Onglet privé : Tableau de bord (Créateur) */}
            {isAuthenticated && isOrganizer && ( // Double condition
              <NavLink to="/dashboard" className={navLinkClass}>
                Dashboard
              </NavLink>
            )}
          </div>

          {/* BLOC AUTH DESKTOP */}
          <div className="hidden sm:flex items-center gap-4">
            {isAuthenticated ? ( // Si connecté
              <>
                {/* Lien vers le profil avec pastille de l'initiale */}
                <NavLink
                  to="/profile"
                  className="flex items-center gap-2 text-sm font-sans text-noir-200 hover:text-noir-50 transition-colors duration-200"
                >
                  {/* Pastille Avatar CSS */}
                  <span className="w-7 h-7 rounded-sm bg-noir-750 border border-noir-650 flex items-center justify-center text-xs font-semibold text-sol">
                    {user?.firstName?.[0]?.toUpperCase()} {/* Première lettre */}
                  </span>
                  <span>{user?.firstName}</span>
                </NavLink>
                <div className="w-px h-4 bg-noir-700" /> {/* Séparateur vertical */}
                <button
                  onClick={handleLogout}
                  className="text-noir-400 hover:text-red-400 transition-colors duration-200"
                  title="Déconnexion"
                >
                  <LogOut className="w-4 h-4" /> {/* Icône Logout */}
                </button>
              </>
            ) : ( // Si déconnecté
              <>
                <Link to="/login" className="btn-ghost text-sm">
                  Connexion
                </Link>
                <Link to="/register" className="btn-sol">
                  S'inscrire
                </Link>
              </>
            )}
          </div>

          {/* MENU HAMBURGER MOBILE */}
          <button
            onClick={() => setIsOpen(!isOpen)} // Inverse l'état
            className="sm:hidden text-noir-300 hover:text-noir-50 transition-colors duration-200 p-1"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* MENU MOBILE DÉROULANT */}
      {isOpen && ( // Affichage conditionnel
        <div className="sm:hidden absolute w-full bg-noir-900/98 backdrop-blur-xl border-b border-noir-800 animate-slide-down">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            <MobileLink to="/events" onClick={() => setIsOpen(false)}>
              Explorer les événements
            </MobileLink>

            {isAuthenticated ? ( // Mode connecté Mobile
              <>
                <MobileLink to="/my-tickets" onClick={() => setIsOpen(false)}>
                  <Receipt className="w-4 h-4" /> Mes billets
                </MobileLink>
                <MobileLink to="/profile" onClick={() => setIsOpen(false)}>
                  Mon profil — {user?.firstName}
                </MobileLink>
                {isOrganizer && ( // Restriction
                  <MobileLink to="/dashboard" onClick={() => setIsOpen(false)}>
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                  </MobileLink>
                )}
                <div className="pt-2 border-t border-noir-800">
                  <button
                    onClick={() => { handleLogout(); setIsOpen(false); }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm font-sans text-red-400 hover:bg-red-950/30 rounded-sm transition-colors duration-150"
                  >
                    <LogOut className="w-4 h-4" /> Déconnexion
                  </button>
                </div>
              </>
            ) : ( // Mode déconnecté Mobile
              <div className="flex flex-col gap-2 pt-3 border-t border-noir-800">
                <Link to="/login" onClick={() => setIsOpen(false)} className="btn-ghost w-full justify-center">
                  Connexion
                </Link>
                <Link to="/register" onClick={() => setIsOpen(false)} className="btn-sol w-full justify-center">
                  S'inscrire
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  ); 
} 

/**
 * Sous-composant pour les liens du menu mobile.
 * Uniformise les paddings et les hovers tactiles.
 */
function MobileLink({ // Composant local
  to,
  onClick,
  children,
}: {
  to: string;
  onClick: () => void;
  children: React.ReactNode;
}) { // Début MobileLink
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 text-sm font-sans text-noir-200 hover:text-noir-50 hover:bg-noir-800/50 rounded-sm transition-colors duration-150"
    >
      {children}
    </Link>
  );
}