import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios'; 
import { Loader2, AlertCircle } from 'lucide-react';

export default function Register() { // Définition de la page d'Inscription
  // ÉTAT GLOBAL DU FORMULAIRE 
  const [formData, setFormData] = useState({ // Regroupement des champs en un seul objet
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    isOrganizer: false, // Case à cocher : "Je suis un organisateur"
  });
  const [error, setError] = useState(''); // Gestion des erreurs API
  const [loading, setLoading] = useState(false); // Spinner de soumission
  const navigate = useNavigate(); // Outil de routage

  /**
   * Gère la soumission du formulaire d'inscription.
   */
  const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try { 
      // 1. Initialise les rôles (Tout le monde est au moins ROLE_USER)
      const roles = ['ROLE_USER']; 
      
      // 2. Si l'utilisateur a coché "Organisateur", on ajoute le rôle Créateur
      if (formData.isOrganizer) {
        roles.push('ROLE_EVENT_CREATOR'); 
      } 

      // 3. Appel API POST /auth/register 
      await api.post('/auth/register', { ...formData, roles }); 
      
      // 4. Succès : Redirection vers le Login pour que l'utilisateur se connecte
      navigate('/login'); 
      
    } catch (err: any) { // Capture type axios
      setError(err.response?.data?.message || 'Erreur lors de la création du compte.'); 
    } finally {
      setLoading(false); 
    } 
  };

  return ( // Rendu
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-fade-up">

        {/* TITRAGE ET TITRE */}
        <div className="mb-10">
          <div className="label-sol mb-3">Rejoignez-nous</div>
          <h1 className="font-display font-bold text-[clamp(2.5rem,6vw,4rem)] leading-[0.9] text-noir-50 mb-4">
            Créez votre<br />
            <span className="italic" style={{ color: '#E8A730' }}>compte.</span>
          </h1>
          <p className="text-sm font-sans text-noir-400">
            Déjà membre ?{' '}
            <Link to="/login" className="text-sol hover:text-sol-300 transition-colors duration-200 underline underline-offset-2">
              Se connecter
            </Link>
          </p>
        </div>

        {/* CARTE FORMULAIRE */}
        <div className="card-dark p-7">
          <form onSubmit={handleSubmit} className="space-y-4"> {/* Soumission */}

            {/* Affichage Alerte Erreur */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-sm px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-sans">{error}</p>
              </div>
            )}

            {/* Grille : Prénom + Nom (Côte à côte) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-dim block mb-2">Prénom</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} // Update local
                  placeholder="Jean"
                  className="input-dark"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="label-dim block mb-2">Nom</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} // Update local
                  placeholder="Dupont"
                  className="input-dark"
                  autoComplete="family-name"
                />
              </div>
            </div>

            {/* Champ Email */}
            <div>
              <label className="label-dim block mb-2">Adresse email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} // Update local
                placeholder="vous@exemple.com"
                className="input-dark"
                autoComplete="email"
              />
            </div>

            {/* Champ Mot de passe */}
            <div>
              <label className="label-dim block mb-2">Mot de passe</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })} // Update local
                placeholder="••••••••"
                className="input-dark"
                autoComplete="new-password"
              />
            </div>

            {/* TOGGLE INTERRUPTEUR (ORGANIZATEUR) */}
            <label className="flex items-start gap-3 p-3 rounded-sm border border-noir-700 hover:border-noir-600 cursor-pointer transition-colors duration-200 group">
              <div className="relative mt-0.5 flex-shrink-0">
                <input
                  id="organizer"
                  type="checkbox"
                  checked={formData.isOrganizer}
                  onChange={(e) => setFormData({ ...formData, isOrganizer: e.target.checked })} // Update booléen
                  className="sr-only" // Masque l'input réel au profit du design ci-dessous
                />
                {/* Carré Checkbox personnalisé en Tailwind */}
                <div
                  className={`w-4 h-4 rounded-sm border transition-all duration-200 flex items-center justify-center
                    ${formData.isOrganizer
                      ? 'bg-sol border-sol' // Coché (Jaune)
                      : 'bg-noir-800 border-noir-600 group-hover:border-noir-500' // Décoché
                    }`}
                >
                  {formData.isOrganizer && ( // Affichage coche en SVG
                    <svg className="w-2.5 h-2.5 text-noir-950" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-sans font-medium text-noir-100 leading-none mb-1">
                  Compte organisateur
                </p>
                <p className="text-xs font-sans text-noir-400">
                  Créez et gérez vos propres événements
                </p>
              </div>
            </label>

            {/* Bouton de Validation */}
            <button
              type="submit"
              disabled={loading} // Verrouillé si envoi
              className="btn-sol w-full h-12 text-sm mt-1"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" /> // Spinner
                : "Créer mon compte →"
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
