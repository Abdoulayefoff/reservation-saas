import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Loader2, Plus, Calendar, Users, Ticket, X, TrendingUp } from 'lucide-react'; 
import type { EventType } from './Home'; 
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

// INTERFACES DE STRUCTURE
interface AdminTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  venue: string;
  pricePaid: string;
  status: string;
  paymentStatus: string;
  purchaseDate: string;
}

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

type Tab = 'events' | 'users' | 'tickets'; // Types d'onglets possibles

/**
 * Sous-composant local pour les badges de statut génériques (évènement/billet).
 */
function StatusBadge({ status }: { status: string }) { // Composant local
  if (status === 'PUBLISHED' || status === 'ACTIVE')
    return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">● {status}</span>;
  if (status === 'CANCELLED')
    return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">● {status}</span>;
  return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-noir-900 text-noir-400 border border-noir-700">● {status}</span>;
}

export default function Dashboard() {
  const { user } = useAuth(); // Récupère l'utilisateur connecté
  const isAdmin = user?.roles?.includes('ROLE_ADMIN'); 

  //  ÉTATS LOCAUX 
  const [activeTab, setActiveTab] = useState<Tab>('events'); // Onglet actif (Défaut: events)
  const [events, setEvents] = useState<EventType[]>([]); // Liste évènements créés
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]); // Liste Users (Admin)
  const [adminTickets, setAdminTickets] = useState<AdminTicket[]>([]); // Liste Tickets (Admin)
  const [loading, setLoading] = useState(true); // Témoin chargement global
  const [showModal, setShowModal] = useState(false); // Modal de création évènement
  const { toast, showToast, hideToast } = useToast(); // Hook alertes
  
  // Structures pour nouveau formulaire
  const [newEvent, setNewEvent] = useState({ title: '', description: '', date: '', venue: '' });
  const [pricesAndPlaces, setPricesAndPlaces] = useState({ price: 50, totalSeats: 100 });
  const [isSubmitting, setIsSubmitting] = useState(false); // Spinner de soumission

  /**
   * Charge les évènements créés par l'organisateur/admin.
   */
  const fetchMyCreatedEvents = async () => {
    try {
      const response = await api.get('/events'); // Appel Gateway
      setEvents(response.data.data || response.data || []);
    } catch {
      showToast('Erreur lors du chargement des événements.', 'error');
    }
  };

  /**
   * Charge la liste des utilisateurs (Réservé Admin).
   */
  const fetchAdminUsers = async () => {
    try {
      const response = await api.get('/users'); // Appel Service User
      const raw: any[] = response.data.profiles || response.data.data || response.data || [];
      setAdminUsers(raw.map((u: any) => ({ // Normalisation des champs
        id: u.id,
        firstName: u.firstName ?? u.first_name ?? '',
        lastName: u.lastName ?? u.last_name ?? '',
        email: u.email ?? '',
      })));
    } catch {
      showToast('Erreur lors du chargement des utilisateurs.', 'error');
    }
  };

  /**
   * Charge la liste de TOUS les billets (Réservé Admin).
   */
  const fetchAdminTickets = async () => {
    try {
      const response = await api.get('/tickets/admin'); // Appel Service Tickets Admin
      setAdminTickets(response.data.data || response.data || []);
    } catch {
      showToast('Erreur lors du chargement des billets.', 'error');
    }
  };

  /**
   * Effet de chargement initial des données.
   */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchMyCreatedEvents(); // Commun
      if (isAdmin) { // Spécifique Admin
        await Promise.all([fetchAdminUsers(), fetchAdminTickets()]);
      }
      setLoading(false);
    };
    loadData();
  }, []); // [] = Montage

  /**
   * Remet le formulaire de création à zéro.
   */
  const resetNewEventForm = () => {
    setNewEvent({ title: '', description: '', date: '', venue: '' });
    setPricesAndPlaces({ price: 50, totalSeats: 100 });
  };

  /**
   * Soumet la création d'un nouvel événement.
   * Fait 2 appels API : Création event + Création options de prix.
   */
  const handleCreateEvent = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // 1. Appel Création Évènement
      const response = await api.post('/events', {
        title: newEvent.title,
        description: newEvent.description,
        date: new Date(newEvent.date).toISOString(),
        venue: newEvent.venue,
        price: pricesAndPlaces.price,
        totalSeats: pricesAndPlaces.totalSeats,
        status: 'PUBLISHED',
      });
      
      // 2. Appel Configuration Billetterie (Indispensable pour le flux d'options)
      await api.post(`/events/${response.data.id}/ticket-options`, {
        type: 'STANDARD',
        price: pricesAndPlaces.price,
        quantity: pricesAndPlaces.totalSeats,
      });

      showToast('Événement créé avec succès !', 'success');
      setShowModal(false); // Ferme vue
      resetNewEventForm(); // Clean up
      await fetchMyCreatedEvents(); // Rafraîchit liste
      
    } catch (err: any) {
      showToast(err.response?.data?.message || "Erreur lors de la création.", 'error');
    } finally {
      setIsSubmitting(false);
    }
  }; // Fin handleCreateEvent

  // CALCULS DE STATISTIQUES
  // Total billets vendus sur les évènements listés
  const totalSold = events.reduce((acc, e) => acc + (e.totalSeats - e.availableSeats), 0);
  // Total CA (Chiffre d'Affaire) théorique
  const totalRevenue = events.reduce((acc, e) => acc + (e.totalSeats - e.availableSeats) * e.price, 0);

  // Configuration des onglets dynamiquement selon le rôle
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'events', label: 'Événements', icon: <Calendar className="w-3.5 h-3.5" /> },
    ...(isAdmin ? [ // Injecte la suite uniquement si admin
      { key: 'users' as Tab, label: 'Utilisateurs', icon: <Users className="w-3.5 h-3.5" /> },
      { key: 'tickets' as Tab, label: 'Billets', icon: <Ticket className="w-3.5 h-3.5" /> },
    ] : []),
  ];

  return ( // Rendu Principal
    <div className="space-y-8 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* EN-TÊTE PAGE */}
      <div className="flex items-start justify-between">
        <div>
          <div className="label-sol mb-2">{isAdmin ? 'Administration' : 'Organisateur'}</div>
          <h1 className="font-display font-semibold text-3xl text-noir-50">
            {isAdmin ? 'Dashboard Admin' : 'Mes événements'}
          </h1>
          <p className="text-noir-400 text-sm mt-1 font-sans">
            {isAdmin ? 'Vue globale — événements, utilisateurs et billets.' : 'Gérez vos événements et suivez les ventes.'}
          </p>
        </div>
        {activeTab === 'events' && ( // Bouton création n'a de sens que dans l'onglet évènement
          <button
            onClick={() => { resetNewEventForm(); setShowModal(true); }}
            className="btn-sol"
          >
            <Plus className="w-4 h-4" /> Créer un événement
          </button>
        )}
      </div>

      {/* GRILLE DE STATS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-dark p-5">
          <div className="label-dim mb-3">Événements</div>
          <div className="font-display font-bold text-4xl text-noir-50">{events.length}</div>
          <div className="text-xs font-mono text-noir-400 mt-1">Total créés</div>
        </div>
        <div className="card-dark p-5">
          <div className="label-sol mb-3">Billets vendus</div>
          <div className="font-display font-bold text-4xl text-sol">{totalSold}</div>
          <div className="text-xs font-mono text-noir-400 mt-1">Toutes catégories</div>
        </div>
        <div className="card-dark p-5">
          <div className="label-dim mb-3">Revenus estimés</div>
          <div className="font-display font-bold text-4xl text-noir-50">
            {totalRevenue.toFixed(0)} €
          </div>
          <div className="text-xs font-mono text-noir-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" /> Estimation totale
          </div>
        </div>
      </div>

      {/* ONGLET BARRE (Tabs) — Affiché uniquement si Admin */}
      {isAdmin && (
        <div className="flex items-center gap-0 border-b border-noir-800">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-sans font-medium border-b-2 transition-all duration-200
                ${activeTab === tab.key
                  ? 'border-sol text-sol' // Actif (Bordure jaune)
                  : 'border-transparent text-noir-400 hover:text-noir-200'
                }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* VUE CONDITIONNELLE DE CONTENU */}
      {loading ? ( // 1. Vue Chargement
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-sol" />
          <span className="text-xs font-mono text-noir-400 uppercase tracking-widest">Chargement</span>
        </div>
      ) : ( // 2. Données Chargées
        <>
          {/* A. ONGLET ÉVÈNEMENTS */}
          {activeTab === 'events' && (
            events.length === 0 ? ( // Cas Vide
              <div className="flex flex-col items-center justify-center py-20 card-dark gap-4">
                <div className="w-12 h-12 rounded-sm bg-noir-800 border border-noir-700 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-noir-500" />
                </div>
                <div className="text-center">
                  <div className="label-dim mb-2">Vide</div>
                  <p className="text-noir-300 text-sm">Aucun événement créé pour le moment.</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn-sol mt-2">
                  <Plus className="w-4 h-4" /> Créer votre premier événement
                </button>
              </div>
            ) : ( // Tableau des évènements
              <div className="card-dark overflow-hidden">
                <table className="min-w-full table-dark">
                  <thead>
                    <tr>
                      <th>Titre / Lieu</th>
                      <th>Date</th>
                      <th>Ventes</th>
                      <th>Statut</th>
                      <th className="text-right">Prix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((evt) => {
                      const sold = evt.totalSeats - evt.availableSeats;
                      const pct = Math.round((sold / evt.totalSeats) * 100);
                      return (
                        <tr key={evt.id}>
                          <td>
                            <div className="font-medium text-noir-100">{evt.title}</div>
                            <div className="text-xs text-noir-400 font-mono mt-0.5">{evt.venue}</div>
                          </td>
                          <td>
                            <span className="font-mono text-noir-300">
                              {new Date(evt.eventDate).toLocaleDateString('fr-FR')}
                            </span>
                          </td>
                          <td>
                            {/* Jauge de remplissage */}
                            <div className="w-24 h-1 bg-noir-700 rounded-full overflow-hidden mb-1">
                              <div className="bg-sol h-full rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-mono text-noir-400">
                              {sold} / {evt.totalSeats}
                            </span>
                          </td>
                          <td><StatusBadge status={evt.status} /></td>
                          <td className="text-right">
                            <span className="font-mono text-noir-100">{evt.price} €</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* B. ONGLET UTILISATEURS (Admin uniquement) */}
          {activeTab === 'users' && isAdmin && (
            adminUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 card-dark gap-3">
                <Users className="w-8 h-8 text-noir-600" />
                <p className="text-noir-400 text-sm">Aucun utilisateur trouvé.</p>
              </div>
            ) : (
              <div className="card-dark overflow-hidden">
                <table className="min-w-full table-dark">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Email</th>
                      <th>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-sm bg-noir-700 border border-noir-600 flex items-center justify-center text-xs font-semibold text-sol flex-shrink-0">
                              {u.firstName?.[0]?.toUpperCase()}
                            </div>
                            <span className="text-noir-100 font-medium">{u.firstName} {u.lastName}</span>
                          </div>
                        </td>
                        <td className="text-noir-300">{u.email}</td>
                        <td className="font-mono text-xs text-noir-500">{u.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* C. ONGLET BILLETS (Admin uniquement) */}
          {activeTab === 'tickets' && isAdmin && (
            adminTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 card-dark gap-3">
                <Ticket className="w-8 h-8 text-noir-600" />
                <p className="text-noir-400 text-sm">Aucun billet trouvé.</p>
              </div>
            ) : (
              <div className="card-dark overflow-hidden">
                <table className="min-w-full table-dark">
                  <thead>
                    <tr>
                      <th>N° Billet</th>
                      <th>Événement</th>
                      <th>Lieu</th>
                      <th>Date d'achat</th>
                      <th>Statut</th>
                      <th className="text-right">Prix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminTickets.map((t) => (
                      <tr key={t.id}>
                        <td className="font-mono text-sol text-xs">{t.ticketNumber}</td>
                        <td className="text-noir-100">{t.eventTitle}</td>
                        <td className="text-noir-400">{t.venue}</td>
                        <td className="font-mono text-noir-400 text-xs">
                          {new Date(t.purchaseDate).toLocaleDateString('fr-FR')}
                        </td>
                        <td><StatusBadge status={t.status} /></td>
                        <td className="text-right font-mono text-noir-200">{t.pricePaid} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}

      {/* MODAL DE CRÉATION ÉVÉNEMENT */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isSubmitting && setShowModal(false)} // Verrouille fermeture si envoi
          />
          <div className="relative card-dark max-w-lg w-full p-7 shadow-2xl animate-fade-up overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setShowModal(false)}
              disabled={isSubmitting}
              className="absolute top-4 right-4 text-noir-500 hover:text-noir-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-6">
              <div className="label-sol mb-1">Nouvel événement</div>
              <h2 className="font-display font-semibold text-2xl text-noir-50">Créer un événement</h2>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4"> {/* Envoi */}
              <div>
                <label className="label-dim block mb-2">Titre de l'événement</label>
                <input
                  type="text" required className="input-dark" placeholder="Ex: Daft Punk Live — Paris"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                />
              </div>

              <div>
                <label className="label-dim block mb-2">Description</label>
                <textarea
                  rows={3} required className="input-dark resize-none" placeholder="Décrivez l'événement..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                />
              </div>

              {/* Ligne : Date + Lieu */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-dim block mb-2">Date et heure</label>
                  <input
                    type="datetime-local" required className="input-dark"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-dim block mb-2">Lieu / Salle</label>
                  <input
                    type="text" required className="input-dark" placeholder="Ex: Bercy Arena"
                    value={newEvent.venue}
                    onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                  />
                </div>
              </div>

              {/* Billetterie rattachée */}
              <div className="border-t border-noir-700 pt-4">
                <div className="label-dim mb-3">Billetterie standard</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-dim block mb-2">Prix (€)</label>
                    <input
                      type="number" min="0" required className="input-dark font-mono"
                      value={pricesAndPlaces.price}
                      onChange={(e) => setPricesAndPlaces({ ...pricesAndPlaces, price: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="label-dim block mb-2">Capacité (places)</label>
                    <input
                      type="number" min="1" required className="input-dark font-mono"
                      value={pricesAndPlaces.totalSeats}
                      onChange={(e) => setPricesAndPlaces({ ...pricesAndPlaces, totalSeats: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              {/* Actions de validation */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button" onClick={() => setShowModal(false)} disabled={isSubmitting} className="btn-ghost flex-1"
                >
                  Annuler
                </button>
                <button
                  type="submit" disabled={isSubmitting} className="btn-sol flex-1"
                >
                  {isSubmitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Création...</>
                    : "Publier l'événement →"
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
