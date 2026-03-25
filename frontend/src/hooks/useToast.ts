import { useState, useCallback } from 'react';

// Interface de structure d'un Toast
interface ToastState {
  message: string;
  type: 'success' | 'error';
}

// Hook personnalisé pour piloter un composant Toast, permet d'ouvrir et fermer des notifications facilement sans alourdir le composant principal
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null); // État local du Toast (null = masqué)

  // Déclenche l'affichage d'un Toast, utilise useCallback pour éviter de recréer la fonction à chaque rendu du consommateur
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []); // [] = Référence stable à vie

  // Masque/Ferme le Toast
  const hideToast = useCallback(() => {
    setToast(null); // Reset à null
  }, []); // [] = Référence stable

  return { toast, showToast, hideToast }; 
}
