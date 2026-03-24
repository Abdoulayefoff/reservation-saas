import { useState } from 'react';
import type { EventType } from '../pages/Home'; 
import { MapPin, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext'; 
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios'; 

interface EventCardProps { 
  event: EventType; 
  onPurchaseSuccess?: () => void; 
  animationIndex?: number;
}

export default function EventCard({ event, onPurchaseSuccess, animationIndex = 0 }: EventCardProps) {
  const { isAuthenticated } = useAuth(); // Vérifie si connecté
  const navigate = useNavigate(); // Outil de routage
  
  // ÉTATS LOCAUX
  const [showModal, setShowModal] = useState(false); // Affichage Modal d'Achat
  const [loading, setLoading] = useState(false); // Chargements (Paiement)
  const [error, setError] = useState(''); // Messages d'erreur
  const [success, setSuccess] = useState(false); // Succès paiement
  
  // États formulaire Carte Bancaire
  const [cardNumber, setCardNumber] = useState(''); 
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // FORMATAGE DES DATES
  const eventDate = new Date(event.eventDate);
  const day = eventDate.toLocaleDateString('fr-FR', { day: '2-digit' });
  const month = eventDate.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase();
  const year = eventDate.getFullYear();
  const weekday = eventDate.toLocaleDateString('fr-FR', { weekday: 'long' }).toUpperCase();

  // CALCULS DE STATUT & JAUGE
  // Pourcentage de remplissage (Évitement division par zéro)
  const percentFull = Math.min(
    100,
    Math.round(((event.totalSeats - event.availableSeats) / event.totalSeats) * 100)
  );

  const isSoldOut = event.availableSeats === 0; // Rupture
  const isAlmostFull = event.availableSeats <= 10 && event.availableSeats > 0; // Urgence (<10)

  // Calcule la classe d'animation CSS pour l'apparition en cascade
  const staggerClass = [
    'stagger-1', 'stagger-2', 'stagger-3',
    'stagger-4', 'stagger-5', 'stagger-6',
    'stagger-7', 'stagger-8', 'stagger-9',
  ][animationIndex % 9] ?? 'stagger-1';

  /**
   * Clic sur le bouton de réservation.
   * Redirige si non connecté, sinon ouvre la modal.
   */
  const handleBuyClick = () => { 
    if (!isAuthenticated) { // Sécurité
      navigate('/login'); // Redirige vers connexion
      return; // Stop
    } 
    
    // Réinitialise le formulaire de la modal
    setError('');
    setSuccess(false);
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setShowModal(true); // Ouvre la modal
  }; 

  /**
   * Action de validation du paiement dans la modal.
   */
  const handleConfirmPurchase = async () => {
    // validations basiques des longueurs et formats de saisie
    if (!cardNumber.replace(/\s/g, '') || cardNumber.replace(/\s/g, '').length < 16) {
      setError('Veuillez entrer un numéro de carte valide (16 chiffres).');
      return;
    }
    if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      setError("Veuillez entrer une date d'expiration valide (MM/AA).");
      return;
    }
    if (!cardCvv || cardCvv.length < 3) {
      setError('Veuillez entrer un CVV valide (3 chiffres).');
      return;
    }
    
    setError(''); // Nettoie erreurs
    setLoading(true); 
    
    try { // Appel API
      await api.post('/tickets/buy', { eventId: event.id, quantity: 1, cardNumber }); 
      setSuccess(true); 
      
      // Auto-fermeture après temporisation de 2 secondes
      setTimeout(() => {
        setShowModal(false); // Ferme
        setSuccess(false); // Reset
        onPurchaseSuccess?.(); // Notifie le parent (Rechargement de la liste)
      }, 2000); // 2000ms
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la réservation.'); 
    } finally {
      setLoading(false);
    }
  };

  return ( 
    <>
      {/* VUE CARTE (CARD) */}
      <div
        className={`animate-fade-up ${staggerClass} group card-dark flex flex-col
          hover:border-noir-600 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]
          transition-all duration-300 hover:-translate-y-0.5`}
      >
        {/* En-tête : Date & Badges d'urgence */}
        <div className="px-5 pt-5 pb-4 flex items-start justify-between">
          <div>
            <div className="label-sol mb-0.5">{weekday}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-bold text-3xl text-noir-50 leading-none">{day}</span>
              <span className="font-mono text-sm text-noir-300">{month} {year}</span>
            </div>
          </div>
          {/* Badge ALMOST FULL */}
          {isAlmostFull && (
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-red-400 border border-red-900 px-2 py-1 rounded-sm animate-pulse">
              {event.availableSeats} restantes
            </span>
          )}
          {/* Badge SOLD OUT */}
          {isSoldOut && (
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-noir-400 border border-noir-700 px-2 py-1 rounded-sm">
              Complet
            </span>
          )}
        </div>

        {/* Corps : Titre, Lieu et Description */}
        <div className="px-5 pb-5 flex-grow">
          <Link to={`/events/${event.id}`} className="block mb-3">
            <h3 className="font-display font-semibold text-xl text-noir-50 leading-snug
              group-hover:text-sol-300 transition-colors duration-200 line-clamp-2">
              {event.title}
            </h3>
          </Link>
          <div className="flex items-center gap-1.5 text-noir-300 text-xs font-sans mb-4">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span>{event.venue}</span>
          </div>
          <p className="text-noir-400 text-xs leading-relaxed line-clamp-2">
            {event.description || 'Aucune description disponible pour cet événement.'}
          </p>
        </div>

        {/* Séparateur pointillé effet Billet perforé */}
        <div className="mx-5 border-t border-dashed border-noir-700" />

        {/* Pied de Carte : Prix & Bouton Action */}
        <div className="px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-mono font-medium text-lg text-noir-50 leading-none">
              {event.price} €
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              {/* Barre de progression de la jauge de disponibilité */}
              <div className="w-16 h-1 bg-noir-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700
                    ${percentFull > 85 ? 'bg-red-500' : 'bg-sol'}`}
                  style={{ width: `${percentFull}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-noir-400">
                {event.availableSeats} places
              </span>
            </div>
          </div>
          <button
            onClick={handleBuyClick}
            disabled={isSoldOut} // Verrouillé si plus de stock
            className="btn-sol px-4 py-2 text-xs disabled:opacity-40"
          >
            {isSoldOut ? 'Complet' : 'Réserver →'}
          </button>
        </div>
      </div>

      {/* MODAL D'ACHAT (PURCHASE MODAL) */}
      {showModal && ( // Rendu conditionnel
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" // Fond sombre flouté
            onClick={() => !loading && setShowModal(false)} // Fermeture au clic extérieur hors chargement
          />
          <div className="relative card-dark max-w-md w-full p-6 shadow-2xl animate-fade-up">

            {/* SI SUCCÈS : Vue Confirmation */}
            {success ? ( // Alternance Success / Formulaire
              <div className="py-8 text-center">
                <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-sm flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="label-sol mb-2">Confirmation</div>
                <h3 className="font-display text-2xl font-semibold text-noir-50 mb-2">
                  Billet réservé !
                </h3>
                <p className="text-sm text-noir-300">Retrouvez votre billet dans "Mes billets".</p>
              </div>
            ) : ( // SI FORMULAIRE : Vue Saisie CB
              <>
                <button
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                  className="absolute top-4 right-4 text-noir-500 hover:text-noir-200 transition-colors"
                >
                  <X className="w-4 h-4" /> {/* Icône Croix de fermeture */}
                </button>

                <div className="mb-5">
                  <div className="label-sol mb-1">Paiement sécurisé</div>
                  <h2 className="font-display text-xl font-semibold text-noir-50">
                    Confirmer la réservation
                  </h2>
                </div>

                {/* Résumé de la Commande */}
                <div className="bg-noir-800 border border-noir-700 rounded-sm p-4 mb-5 space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-noir-400">Événement</span>
                    <span className="font-medium text-noir-100 text-right max-w-[60%] truncate">{event.title}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-noir-400">Lieu</span>
                    <span className="text-noir-200">{event.venue}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-noir-400">Date</span>
                    <span className="text-noir-200">
                      {new Date(event.eventDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="border-t border-dashed border-noir-650 pt-2.5 flex justify-between items-center">
                    <span className="text-noir-200 text-sm font-semibold">Total</span>
                    <span className="font-mono font-bold text-xl text-sol">{event.price} €</span>
                  </div>
                </div>

                {/* Saisie Coordonnées Bancaires */}
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="label-dim block mb-1.5">Numéro de carte</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={19}
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={(e) => { // Auto-espacement tous les 4 chiffres
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
                        setCardNumber(digits.replace(/(.{4})/g, '$1 ').trim());
                      }}
                      disabled={loading}
                      className="input-dark font-mono"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="label-dim block mb-1.5">Expiration</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) => { // Auto-slash MM/AA
                          const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                          setCardExpiry(v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v);
                        }}
                        disabled={loading}
                        className="input-dark font-mono"
                      />
                    </div>
                    <div className="w-24">
                      <label className="label-dim block mb-1.5">CVV</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={3}
                        placeholder="123"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                        disabled={loading}
                        className="input-dark font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Affichage d'Erreurs Formulaire */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-sm px-4 py-3 mb-4 font-sans">
                    {error}
                  </div>
                )}

                {/* Barre d'Action de validation */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={loading}
                    className="btn-ghost flex-1"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmPurchase}
                    disabled={loading}
                    className="btn-sol flex-1"
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Traitement...</>
                      : "Payer →"
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
