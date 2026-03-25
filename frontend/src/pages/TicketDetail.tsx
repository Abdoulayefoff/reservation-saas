import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios'; 
import {
  ArrowLeft, Loader2, CheckCircle, XCircle,
  Calendar, MapPin, CreditCard, Hash, Clock,
} from 'lucide-react'; 

// INTERFACE BILLET DÉTAILLÉ (Modèle de données complet)
interface TicketFull {
  id: string;
  ticketNumber: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  pricePaid: string;
  paymentMethod: string;
  paymentStatus: string;
  status: 'ACTIVE' | 'CANCELLED' | 'USED';
  purchaseDate: string;
  transactionId?: string; 
}

export default function TicketDetail() { 
  const { id } = useParams<{ id: string }>(); // Récupère l'ID du billet depuis URL : /tickets/:id
  
  // ÉTATS LOCAUX
  const [ticket, setTicket] = useState<TicketFull | null>(null); // State de la donnée chargée
  const [loading, setLoading] = useState(true); // Témoin de chargement
  const [notFound, setNotFound] = useState(false); // Drapeau crash / non trouvé

  /**
   * Effet de chargement du billet cible au montage.
   */
  useEffect(() => {
    if (!id) return;
    
    api.get(`/tickets/${id}`) // Appel GET /tickets/:id
      .then((res) => setTicket(res.data))
      .catch((err) => { // Échec
        // 404 (absent) ou 403 (tentative de voir le billet d'un tiers)
        if (err.response?.status === 404 || err.response?.status === 403) setNotFound(true); 
      })
      .finally(() => setLoading(false));
  }, [id]); // Dépend de l'ID URL

  // RENDUS PRÉCOCES

  if (loading) { // 1. Vue Chargement
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-sol" />
        <span className="text-xs font-mono text-noir-400 uppercase tracking-widest">Chargement</span>
      </div>
    );
  }

  if (notFound || !ticket) { // 2. Vue Introuvable / Erreur sécuritaire
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="label-dim">Erreur</div>
        <h2 className="font-display text-3xl font-semibold text-noir-50">Billet introuvable</h2>
        <p className="text-noir-400 text-sm">Ce billet n'existe pas ou vous n'y avez pas accès.</p>
        <Link to="/my-tickets" className="btn-sol mt-4">← Retour à mes billets</Link>
      </div>
    );
  }

  // PRÉPARATION DES VARIABLES D'AFFICHAGE (Dictionnaires)
  
  // Configuration UI selon le statut physique du billet
  const statusConfig = {
    ACTIVE: {
      icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
      label: 'Actif',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      glowClass: 'shadow-[0_0_20px_rgba(52,211,153,0.08)]', // Effet brillant vert subtil
    },
    CANCELLED: {
      icon: <XCircle className="w-5 h-5 text-red-400" />,
      label: 'Annulé',
      badgeClass: 'bg-red-50 text-red-600 border-red-200',
      glowClass: '',
    },
    USED: {
      icon: <Clock className="w-5 h-5 text-noir-400" />,
      label: 'Utilisé',
      badgeClass: 'bg-noir-900 text-noir-400 border-noir-700',
      glowClass: '',
    },
  };

  // Récupère l'objet de config correspondant au statut du billet
  const status = statusConfig[ticket.status] ?? statusConfig.USED;

  // Tableau d'itération pour générer les lignes du rapport
  const rows = [
    {
      icon: <Hash className="w-3.5 h-3.5 text-sol" />,
      label: 'N° de billet',
      value: <span className="font-mono font-semibold text-sol text-sm">{ticket.ticketNumber}</span>,
    },
    {
      icon: <Calendar className="w-3.5 h-3.5 text-sol" />,
      label: "Date de l'événement",
      value: <span className="text-noir-100 text-sm">{new Date(ticket.eventDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>,
    },
    {
      icon: <MapPin className="w-3.5 h-3.5 text-sol" />,
      label: 'Lieu',
      value: <span className="text-noir-100 text-sm">{ticket.venue}</span>,
    },
    {
      icon: <Calendar className="w-3.5 h-3.5 text-sol" />,
      label: "Date d'achat",
      value: <span className="text-noir-100 text-sm">{new Date(ticket.purchaseDate).toLocaleString('fr-FR')}</span>,
    },
    {
      icon: <CreditCard className="w-3.5 h-3.5 text-sol" />,
      label: 'Montant payé',
      value: <span className="font-mono font-bold text-noir-50">{parseFloat(ticket.pricePaid).toFixed(2)} €</span>,
    },
    {
      icon: <CreditCard className="w-3.5 h-3.5 text-sol" />,
      label: 'Paiement',
      value: <span className="text-noir-300 text-sm font-mono">{ticket.paymentMethod} — {ticket.paymentStatus}</span>,
    },
  ];

  return ( // Rendu Principal
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">

      {/* Lien Retour simple */}
      <Link to="/my-tickets" className="inline-flex items-center gap-2 text-sm font-sans text-noir-400 hover:text-noir-100 transition-colors duration-200">
        <ArrowLeft className="w-3.5 h-3.5" /> Retour à mes billets
      </Link>

      {/* CARTE BILLET (TICKET CARD) */}
      <div className={`card-dark overflow-hidden ${status.glowClass}`}>

        {/* Partie Haute — Dégradé design standard application */}
        <div
          className="relative p-7 pb-6"
          style={{ background: 'linear-gradient(135deg, #1C1814 0%, #2A241C 100%)' }}
        >
          {/* Décoration de fond rétro-éclairage (Chiffre de la date) */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 font-display font-black text-[6rem] leading-none text-noir-800 select-none pointer-events-none">
            {new Date(ticket.eventDate).getDate().toString().padStart(2, '0')}
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              <div className="label-sol">Billet électronique</div>
              {/* Badge Statut pastille dynamique */}
              <span className={`inline-flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${status.badgeClass}`}>
                {status.icon}
                {status.label}
              </span>
            </div>

            <h2 className="font-display font-bold text-2xl text-white leading-tight mb-2">
              {ticket.eventTitle}
            </h2>
            <div className="flex items-center gap-1.5 text-sm text-white/60">
              <MapPin className="w-3.5 h-3.5" /> {ticket.venue}
            </div>
          </div>
        </div>

        {/* Bande de perforation visuelle (Découpage ticket cinéma) */}
        <div className="relative px-7">
          <div className="border-t border-dashed border-noir-700" />
          {/* Cercles de découpe faux-bordure gauche/droite */}
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-noir-950" />
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-noir-950" />
        </div>

        {/* Partie Basse : Corps de détails en listes */}
        <div className="p-7 space-y-0">
          {rows.map((row, i) => ( // Itération des lignes du tableau préparé en amont
            <div key={i} className={`flex items-center justify-between py-3.5 ${i < rows.length - 1 ? 'border-b border-noir-800' : ''}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-sm bg-noir-800 border border-noir-700 flex items-center justify-center flex-shrink-0">
                  {row.icon}
                </div>
                <span className="text-xs font-mono text-noir-400">{row.label}</span>
              </div>
              <div className="text-right max-w-[55%]">{row.value}</div>
            </div>
          ))}
        </div>

        {/* Pied de Carte : Navigation d'action */}
        <div className="px-7 py-4 bg-noir-800/50 border-t border-noir-700 flex items-center justify-between">
          <Link
            to={`/events/${ticket.eventId}`} // Revoir l'évènement d'origine
            className="text-xs font-mono text-sol hover:text-sol-300 transition-colors duration-200"
          >
            Voir l'événement →
          </Link>
          
          {/* Action annulation rapide si actif */}
          {ticket.status === 'ACTIVE' && (
            <Link
              to="/my-tickets" // Renvoie vers la liste qui porte les triggers d'annulation
              className="text-xs font-mono text-red-500 hover:text-red-400 transition-colors duration-200"
            >
              Annuler ce billet
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
