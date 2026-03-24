import React, { useState } from 'react'; 
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
  // ÉTATS LOCAUX DU FORMULAIRE
  const [email, setEmail] = useState(''); // Champ Email
  const [password, setPassword] = useState(''); // Champ Mot de Passe
  const [error, setError] = useState(''); // Message d'erreur API
  const [loading, setLoading] = useState(false); // État de soumission
  
  const navigate = useNavigate(); // Outil de navigation
  const { login } = useAuth(); // Méthode de "login" du contexte Auth

  /**
   * Gère la soumission du formulaire de connexion.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try { 
      // Appel API POST sur /auth/login (Via Gateway)
      const response = await api.post('/auth/login', { email, password }); 
      
      // Appel de la fonction contextuelle pour actualiser l'état globale React
      login(response.data.token, response.data.user); 
      
      // Sauvegarde du Refresh Token séparément pour la rotation automatique
      if (response.data.refresh_token) { 
        localStorage.setItem('refresh_token', response.data.refresh_token); 
      } 
      navigate('/'); // Redirection vers l'accueil en cas de succès
    } catch (err: any) {
      setError(err.response?.data?.message || 'Identifiants incorrects.'); 
    } finally {
      setLoading(false);
    } 
  };

  return ( // Rendu
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-fade-up">

        {/* TITRAGE ET TITRE */}
        <div className="mb-10">
          <div className="label-sol mb-3">Accès membre</div>
          <h1 className="font-display font-bold text-[clamp(2.5rem,6vw,4rem)] leading-[0.9] text-noir-50 mb-4">
            Bon retour<br />
            <span className="italic" style={{ color: '#E8A730' }}>par ici.</span>
          </h1>
          <p className="text-sm font-sans text-noir-400">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-sol hover:text-sol-300 transition-colors duration-200 underline underline-offset-2">
              S'inscrire gratuitement
            </Link>
          </p>
        </div>

        {/* CARTE FORMULAIRE */}
        <div className="card-dark p-7">
          <form onSubmit={handleSubmit} className="space-y-5"> {/* Déclenche handleSubmit */}

            {/* Affichage Alerte Erreur */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-sm px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-sans">{error}</p>
              </div>
            )}

            {/* Champ Email */}
            <div>
              <label className="label-dim block mb-2">Adresse email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)} // Bind state
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
                value={password}
                onChange={(e) => setPassword(e.target.value)} // Bind state
                placeholder="••••••••"
                className="input-dark"
                autoComplete="current-password"
              />
            </div>

            {/* Bouton de Validation */}
            <button
              type="submit"
              disabled={loading} // Verrouillé si envoi en cours
              className="btn-sol w-full h-12 text-sm mt-2"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" /> 
                : 'Se connecter →'
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
