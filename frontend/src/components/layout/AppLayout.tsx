import Navbar from './Navbar'; 
import { Outlet } from 'react-router-dom';

/**
 * Layout principal de l'application (Gabarit).
 * Contient la structure globale visible sur presque toutes les pages :
 * - Film grain subtil (Overlay CSS fixe)
 * - Lueur ambiante en arrière-plan (Glow)
 * - Header (Navbar)
 * - Zone de contenu principale (<main>) où s'injectera la page courante via <Outlet />
 * - Footer
 */
export default function AppLayout() {
  return (
    <div className="min-h-screen bg-noir-950 flex flex-col font-sans relative">

      {/* OVERLAY GRAIN CINÉMATIQUE */}
      {/* Utilisé pour donner un aspect premium/texture à l'écran */}
      <div
        className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.018] grain"
        aria-hidden="true"
      />

      {/* LUEUR AMBIANTE (AMBIENT GLOW) top left */}
      <div
        className="fixed top-0 left-0 w-[600px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 20% 10%, rgba(232,167,48,0.05) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* BARRE DE NAVIGATION (HEADER) */}
      <Navbar />

      {/* ZONE DE CONTENU PRINCIPALE (BODY) */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Le composant Outlet est remplacé dynamiquement par la page Router courante (Home, Login, etc.) */}
        <Outlet /> 
      </main>

      {/* PIED DE PAGE (FOOTER) */}
      <footer className="border-t border-noir-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <span className="font-display text-noir-50 font-semibold">TicketSaaS</span>
            <span className="text-noir-700">·</span>
            <span className="text-xs font-mono text-noir-400">© 2026</span>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono text-noir-400">
            <a href="#" className="hover:text-sol transition-colors duration-200">Mentions légales</a>
            <a href="#" className="hover:text-sol transition-colors duration-200">CGV</a>
            <a href="#" className="hover:text-sol transition-colors duration-200">Confidentialité</a>
          </div>

        </div>
      </footer>
    </div>
  );
}
