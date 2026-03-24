import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Calendar, MapPin, Users, ArrowLeft, Loader2, X, CheckCircle } from 'lucide-react'; 
import type { EventType } from './Home'; 

export default function EventDetail() { // Définition de la page de Détail
  const { id } = useParams<{ id: string }>(); // Récupère l'ID depuis l'URL /events/:id
  const { isAuthenticated } = useAuth(); 
  const navigate = useNavigate();

  // ÉTATS LOCAUX
  const [event, setEvent] = useState<EventType | null>(null); // Données de l'évènement
  const [loading, setLoading] = useState(true); // Témoin de chargement
  const [notFound, setNotFound] = useState(false); // Drapeau 404
  const [showModal, setShowModal] = useState(false); // Affichage Modal d'Achat
  
  const [buying, setBuying] = useState(false); // État submit de l'achat
  const [buyError, setBuyError] = useState(''); // Erreur d'achat
  const [buySuccess, setBuySuccess] = useState(false); // Succès d'achat
  
  // Champs CB
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  /**
   * Effet de chargement de l'évènement cible.
   */
  useEffect(() => {
    if (!id) return;
    
    api.get(`/events/${id}`) // Requête GET sur la Gateway
      .then((res) => setEvent(res.data))
      .catch((err) => { 
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  /**
   * Action de clic sur Réserver.
   * Redirige vers /login si anonyme, sinon ouvre la modal de paiement.
   */
  const handleBuy = () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setBuyError('');
    setBuySuccess(false);
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setShowModal(true); // Ouvre vue
  }; 

  /**
   * Soumission du Paiement (Simulation).
   */
  const confirmPurchase = async () => {
    // Validations structurelles côté client
    if (!cardNumber.replace(/\s/g, '') || cardNumber.replace(/\s/g, '').length < 16) {
      setBuyError('Veuillez entrer un numéro de carte valide (16 chiffres).');
      return;
    }
    if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      setBuyError("Veuillez entrer une date d'expiration valide (MM/AA).");
      return;
    }
    if (!cardCvv || cardCvv.length < 3) {
      setBuyError('Veuillez entrer un CVV valide (3 chiffres).');
      return;
    }
    setBuyError('');
    setBuying(true);
    
    try {
      // 1. Appel d'achat
      await api.post('/tickets/buy', { eventId: id, quantity: 1, cardNumber });
      setBuySuccess(true); // Bascule Vue Succès
      
      // 2. Re-charge l'évènement pour actualiser 'availableSeats' instantanément
      const res = await api.get(`/events/${id}`);
      setEvent(res.data);
      
      // 3. Temporisation fermeture automatique
      setTimeout(() => { setShowModal(false); setBuySuccess(false); }, 2500);
    } catch (err: any) {
      setBuyError(err.response?.data?.error || 'Erreur lors de la réservation.');
    } finally {
      setBuying(false);
    }
  };

  // RENDUS PRÉCOCES

  if (loading) { // Vue Chargement
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-sol" />
        <span className="text-xs font-mono text-noir-400 uppercase tracking-widest">Chargement</span>
      </div>
    );
  }

  if (notFound || !event) { // Vue 404
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="label-dim">404</div>
        <h2 className="font-display text-3xl font-semibold text-noir-50">Événement introuvable</h2>
        <p className="text-noir-400 text-sm">Cet événement n'existe pas ou a été supprimé.</p>
        <Link to="/events" className="btn-sol mt-4">
          ← Retour aux événements
        </Link>
      </div>
    );
  }

  // PRÉPARATION DES VARIABLES DE CALCUL D'AFFICHAGE
  // Formatage date à la française complet
  const formattedDate = new Date(event.eventDate).toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  
  const shortDate = new Date(event.eventDate);
  const day = shortDate.toLocaleDateString('fr-FR', { day: '2-digit' });
  const month = shortDate.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase();
  const year = shortDate.getFullYear();

  // Pourcentage de remplissage
  const percentFull = Math.min(100, Math.round(((event.totalSeats - event.availableSeats) / event.totalSeats) * 100));

  const isSoldOut = event.availableSeats === 0; // Complet
  const isAvailable = event.availableSeats > 0 && event.status === 'PUBLISHED'; // Prêt pour achat

  const statusLabel: Record<string, string> = { // Dictionnaire de traduction Fr des statuts
    PUBLISHED: 'En vente',
    DRAFT: 'Brouillon',
    CANCELLED: 'Annulé',
  };

  return ( // Rendu Principal
    <>
      <div className="space-y-8 animate-fade-in">

        {/* Lien de Retour simple */}
        <Link
          to="/events"
          className="inline-flex items-center gap-2 text-sm font-sans text-noir-400 hover:text-noir-100 transition-colors duration-200"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour aux événements
        </Link>

        {/* BLOC HERO (Bannière) */}
        <div className="card-dark overflow-hidden">
          <div
            className="relative h-56 sm:h-72 flex items-end"
            style={{ background: 'linear-gradient(135deg, #1C1814 0%, #2A241C 50%, #1C1814 100%)' }}
          >
            {/* Lueur d'ambiance design */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 60% 80% at 80% 50%, rgba(232,167,48,0.07) 0%, transparent 70%)' }}
            />
            {/* Tag Date géant en background translucide (Effet affichage) */}
            <div className="absolute top-6 right-8 text-right pointer-events-none">
              <div className="font-display font-black text-[5rem] sm:text-[7rem] leading-none text-noir-800 select-none">
                {day}
              </div>
              <div className="font-mono text-sm text-noir-600 -mt-2">{month} {year}</div>
            </div>

            <div className="relative z-10 p-7 sm:p-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="label-sol">Événement</span>
                <span className={`text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border
                  ${event.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    event.status === 'CANCELLED' ? 'bg-red-50 text-red-600 border-red-200' :
                    'bg-white/20 text-white/80 border-white/30'}`}
                >
                  {statusLabel[event.status] ?? event.status}
                </span>
              </div>
              <h1 className="font-display font-bold text-[clamp(1.8rem,4vw,3rem)] text-white leading-tight max-w-xl">
                {event.title}
              </h1>
              <div className="flex items-center gap-1.5 mt-3 text-sm text-white/60">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> {event.venue}
              </div>
            </div>
          </div>
        </div>

        {/* GRILLE DE CONTENU (Grille : Détails Gauche / Sidebar Droite) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Colonne Gauche : Infos textuelles */}
          <div className="md:col-span-2 space-y-5">

            {/* Teaser / À propos */}
            <div className="card-dark p-6">
              <div className="label-dim mb-3">À propos</div>
              <p className="text-noir-200 leading-relaxed text-sm font-sans whitespace-pre-line">
                {event.description || "Aucune description disponible pour cet événement."}
              </p>
            </div>

            {/* Fiche Technique (Lieu, Date, Places) avec listes d'icônes */}
            <div className="card-dark p-6 space-y-5">
              <div className="label-dim">Détails</div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-sm bg-noir-800 border border-noir-700 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-sol" />
                </div>
                <div>
                  <div className="text-xs font-mono text-noir-400 mb-0.5">Date et heure</div>
                  <div className="text-sm text-noir-100 font-sans capitalize">{formattedDate}</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-sm bg-noir-800 border border-noir-700 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-sol" />
                </div>
                <div>
                  <div className="text-xs font-mono text-noir-400 mb-0.5">Lieu</div>
                  <div className="text-sm text-noir-100 font-sans">{event.venue}</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-sm bg-noir-800 border border-noir-700 flex items-center justify-center flex-shrink-0">
                  <Users className="w-3.5 h-3.5 text-sol" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-mono text-noir-400 mb-0.5">Disponibilité</div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-noir-200">{event.availableSeats} places restantes sur {event.totalSeats}</span>
                    <span className={`font-mono text-xs ${percentFull > 85 ? 'text-red-400' : 'text-sol'}`}>{percentFull}%</span>
                  </div>
                  {/* Jauge CSS Progress bar */}
                  <div className="h-1.5 bg-noir-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${percentFull > 85 ? 'bg-red-500' : 'bg-sol'}`}
                      style={{ width: `${percentFull}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Colonne Droite : Achat Billetterie (Sticky) */}
          <div>
            <div className="card-dark p-6 sticky top-24">
              <div className="label-dim mb-2">Billetterie</div>
              <div className="font-mono font-bold text-4xl text-noir-50 mb-0.5">{event.price} €</div>
              <div className="text-xs text-noir-400 font-sans mb-6">par billet · prix fixe</div>

              <div className="border-t border-dashed border-noir-700 mb-6" />

              {/* Action Réserver */}
              {isAvailable ? (
                <button onClick={handleBuy} className="btn-sol w-full h-12 text-sm mb-3">
                  Réserver mon billet →
                </button>
              ) : (
                <button disabled className="btn-ghost w-full h-12 text-sm mb-3 opacity-50 cursor-not-allowed">
                  {isSoldOut ? 'Complet' : 'Non disponible'}
                </button>
              )}

              <Link
                to="/my-tickets"
                className="block text-center text-xs font-mono text-noir-500 hover:text-sol transition-colors duration-200"
              >
                Voir mes billets →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE PAIEMENT (Similaire à EventCard) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !buying && setShowModal(false)} />
          <div className="relative card-dark max-w-md w-full p-7 shadow-2xl animate-fade-up">
            {buySuccess ? ( // Succès
              <div className="py-8 text-center">
                <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-sm flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="w-7 h-7 text-emerald-600" />
                </div>
                <div className="label-sol mb-2">Confirmation</div>
                <h3 className="font-display text-2xl font-semibold text-noir-50 mb-2">Billet réservé !</h3>
                <p className="text-sm text-noir-300">Retrouvez votre billet dans "Mes billets".</p>
              </div>
            ) : ( // Formulaire
              <>
                <button onClick={() => setShowModal(false)} disabled={buying} className="absolute top-4 right-4 text-noir-500 hover:text-noir-200 transition-colors">
                  <X className="w-4 h-4" />
                </button>
                <div className="mb-5">
                  <div className="label-sol mb-1">Paiement sécurisé</div>
                  <h2 className="font-display text-xl font-semibold text-noir-50">Confirmer la réservation</h2>
                </div>

                {/* Résumé */}
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
                    <span className="text-noir-200">{new Date(event.eventDate).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="border-t border-dashed border-noir-650 pt-2.5 flex justify-between items-center">
                    <span className="text-sm font-semibold text-noir-200">Total</span>
                    <span className="font-mono font-bold text-xl text-sol">{event.price} €</span>
                  </div>
                </div>

                {/* Coordonnées */}
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="label-dim block mb-1.5">Numéro de carte</label>
                    <input
                      type="text" inputMode="numeric" maxLength={19}
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
                        setCardNumber(digits.replace(/(.{4})/g, '$1 ').trim());
                      }}
                      disabled={buying} className="input-dark font-mono"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="label-dim block mb-1.5">Expiration</label>
                      <input
                        type="text" inputMode="numeric" maxLength={5} placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                          setCardExpiry(v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v);
                        }}
                        disabled={buying} className="input-dark font-mono"
                      />
                    </div>
                    <div className="w-24">
                      <label className="label-dim block mb-1.5">CVV</label>
                      <input
                        type="text" inputMode="numeric" maxLength={3} placeholder="123"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                        disabled={buying} className="input-dark font-mono"
                      />
                    </div>
                  </div>
                </div>

                {buyError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-sm px-4 py-3 mb-4">
                    {buyError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setShowModal(false)} disabled={buying} className="btn-ghost flex-1">Annuler</button>
                  <button onClick={confirmPurchase} disabled={buying} className="btn-sol flex-1">
                    {buying ? <><Loader2 className="w-4 h-4 animate-spin" /> Traitement...</> : 'Payer →'}
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
