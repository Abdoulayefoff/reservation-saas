import { useEffect, useState } from 'react'; 
import api from '../api/axios';
import { Loader2, Calendar, MapPin, CheckCircle, XCircle, Clock } from 'lucide-react'; 
import { Link } from 'react-router-dom';
import Toast from '../components/Toast'; 
import { useToast } from '../hooks/useToast';

//  INTERFACE BILLET (Modèle de données) 
interface Ticket {
  id: string;
  ticketNumber: string; 
  eventId: string;
  eventTitle: string;
  venue: string;
  pricePaid: string;
  status: 'ACTIVE' | 'CANCELLED' | 'USED';
  purchaseDate: string;
}

// Sous-composant pour les badges de statut, affiche une pastille colorée (Vert/Rouge/Noir) selon l'état du billet
function StatusBadge({ status }: { status: Ticket['status'] }) {
  if (status === 'ACTIVE') // Actif (Valide)
    return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle className="w-2.5 h-2.5" /> Actif</span>;
  
  if (status === 'CANCELLED') // Annulé (Remboursé)
    return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200"><XCircle className="w-2.5 h-2.5" /> Annulé</span>;
  
  // Défaut : Utilisé
  return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-noir-900 text-noir-400 border border-noir-700"><Clock className="w-2.5 h-2.5" /> Utilisé</span>;
}

export default function MyTickets() {
  // ÉTATS LOCAUX
  const [tickets, setTickets] = useState<Ticket[]>([]); // Liste des billets
  const [loading, setLoading] = useState(true); // Témoin de chargement
  const [cancelingId, setCancelingId] = useState<string | null>(null); // ID du billet en cours d'annulation
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null); // ID du billet demandant confirmation
  const { toast, showToast, hideToast } = useToast(); // Hook d'alertes

  // Récupère la liste des billets de l'utilisateur connecté
  const fetchTickets = async () => {
    try {
      const response = await api.get('/tickets'); 
      setTickets(response.data.data || response.data || []);
    } catch {
      showToast('Erreur lors du chargement de vos billets.', 'error'); 
    } finally {
      setLoading(false);
    }
  };

  // Montage initiale : Lance la recherche
  useEffect(() => { 
    fetchTickets(); 
  }, []);

  /**
   * Action d'annulation d'un billet via l'API.
   * @param ticketId UUID du billet cible
   */
  const handleCancel = async (ticketId: string) => { 
    setConfirmCancelId(null); // Ferme la boîte de dialogue de confirmation
    setCancelingId(ticketId); // Bloque le bouton en mode Spinner
    try {
      await api.patch(`/tickets/${ticketId}/cancel`); // Appel PATCH /tickets/:id/cancel sur Gateway
      showToast('Billet annulé avec succès.', 'success'); 
      await fetchTickets();
    } catch {
      showToast("Erreur lors de l'annulation du billet.", 'error');
    } finally {
      setCancelingId(null);
    }
  };

  return ( // Rendu
    <div className="space-y-8 animate-fade-in">
      {/* Affichage d'un Toast si l'état 'toast' du hook est non-nul */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* EN-TÊTE PAGE */}
      <div className="flex items-end justify-between border-b border-noir-800 pb-6">
        <div>
          <div className="label-sol mb-2">Mes réservations</div>
          <h1 className="font-display font-semibold text-3xl text-noir-50">Mes Billets</h1>
          <p className="text-noir-400 text-sm mt-1 font-sans">
            Consultez l'historique de vos réservations.
          </p>
        </div>
        <Link to="/events" className="btn-ghost text-sm">
          + Réserver un billet
        </Link>
      </div>

      {/* VUES CONDITIONNELLES (Buffer / Vide / Liste) */}
      {loading ? ( // 1. En cours de chargement
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-sol" />
          <span className="text-xs font-mono text-noir-400 uppercase tracking-widest">Chargement</span>
        </div>
      ) : tickets.length === 0 ? ( // 2. Aucun billet
        <div className="flex flex-col items-center justify-center py-20 card-dark gap-4">
          <div className="w-14 h-14 rounded-sm bg-noir-800 border border-noir-700 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-7 h-7 text-noir-500">
              <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-center">
            <div className="label-dim mb-2">Vide</div>
            <p className="text-noir-300 text-sm font-sans">Vous n'avez pas encore acheté de billets.</p>
          </div>
          <Link to="/events" className="btn-sol mt-2">
            Découvrir les événements →
          </Link>
        </div>
      ) : ( // 3. Affichage de la liste de billets
        <div className="space-y-4">
          {tickets.map((ticket, i) => (
            <div
              key={ticket.id}
              className={`card-dark overflow-hidden animate-fade-up stagger-${Math.min(i + 1, 9)}`}
            >
              {/* Partie Haute : Numéro de billet pointillé + Statut */}
              <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-dashed border-noir-700">
                <div>
                  <div className="label-dim mb-0.5">Billet électronique</div>
                  <Link
                    to={`/tickets/${ticket.id}`} // Lien vers page détail
                    className="font-mono text-sm text-sol hover:text-sol-300 transition-colors duration-200"
                  >
                    {ticket.ticketNumber ?? `#${ticket.id.substring(0, 8).toUpperCase()}`}
                  </Link>
                </div>
                <StatusBadge status={ticket.status} /> {/* Pastille couleur */}
              </div>

              {/* Partie Milieu : Infos évènement */}
              <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-xl text-noir-50 leading-snug mb-2">
                    {ticket.eventTitle ?? ticket.eventId}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-sans text-noir-400">
                    {ticket.venue && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> {ticket.venue}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      Acheté le {new Date(ticket.purchaseDate).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>

                {/* Bloc Prix & Bouton Action */}
                <div className="flex items-center gap-5 flex-shrink-0">
                  <div className="text-right">
                    <div className="font-mono font-bold text-xl text-noir-50 leading-none">
                      {parseFloat(ticket.pricePaid).toFixed(2)} €
                    </div>
                  </div>

                  {/* Bouton Annuler (Uniquement si Actif) */}
                  {ticket.status === 'ACTIVE' && cancelingId !== ticket.id && confirmCancelId !== ticket.id && (
                    <button
                      onClick={() => setConfirmCancelId(ticket.id)} // Ouvre vérification
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold border border-red-900 text-red-400 hover:border-red-600 hover:text-red-300 transition-all duration-200 rounded-sm"
                    >
                      Annuler
                    </button>
                  )}

                  {/* État Loader d'annulation en cours */}
                  {cancelingId === ticket.id && (
                    <span className="flex items-center gap-1.5 text-xs text-noir-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Annulation...
                    </span>
                  )}
                </div>
              </div>

              {/* BANDEAU DE CONFIRMATION D'ANNULATION (Surgit si clic) */}
              {confirmCancelId === ticket.id && (
                <div className="px-5 py-3 bg-red-50 border-t border-red-200 flex items-center justify-between gap-4 animate-fade-in">
                  <p className="text-sm font-sans text-red-700">Confirmer l'annulation de ce billet ?</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmCancelId(null)} // Ferme
                      className="btn-ghost-sm"
                    >
                      Non
                    </button>
                    <button
                      onClick={() => handleCancel(ticket.id)} // Exécute
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold bg-red-600 text-white hover:bg-red-700 transition-all duration-200 rounded-sm"
                    >
                      Oui, annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
