import { useEffect } from 'react'; 
import { CheckCircle, XCircle, X } from 'lucide-react';

// Propriétés du composant Toast (Notification éphémère)
interface ToastProps {
  message: string; 
  type: 'success' | 'error'; 
  onClose: () => void; 
  duration?: number; // Durée de vie en ms (Optionnel, 4000 par défaut)
}

// Composant Toast flottant pour notifications systèmes, se détruit automatique après `duration` ms.
export default function Toast({ message, type, onClose, duration = 4000 }: ToastProps) {
  
  // Effet de temporisation (Timer) d'auto-destruction
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer); 
  }, [onClose, duration]);
  const isSuccess = type === 'success';

  return (
    // Conteneur fixe haut droit avec animation animate-fade-up
    <div className="fixed top-20 right-5 z-[99999] animate-fade-up">
      <div
        className={`flex items-start gap-3 px-4 py-3.5 rounded-sm shadow-xl border max-w-xs
          ${isSuccess
            ? 'bg-emerald-700 border-emerald-600' // Fond vert
            : 'bg-red-700 border-red-600' // Fond rouge
          }`}
      >
        {/* Affichage de l'icône selon le succès ou l'échec */}
        {isSuccess
          ? <CheckCircle className="w-4 h-4 text-white flex-shrink-0 mt-0.5" />
          : <XCircle className="w-4 h-4 text-white flex-shrink-0 mt-0.5" />
        }
        
        {/* Texte du message */}
        <p className="text-sm font-sans text-white flex-1">{message}</p>
        
        {/* Croix de fermeture manuelle précoce */}
        <button
          onClick={onClose} // Exécute le callback parental
          className="text-white/60 hover:text-white transition-colors duration-150 ml-1 flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" /> 
        </button>
      </div>
    </div>
  );
}
