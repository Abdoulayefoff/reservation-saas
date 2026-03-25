import { useEffect, useState } from 'react';
import api from '../api/axios';
import EventCard from '../components/EventCard';
import { Loader2, Search } from 'lucide-react';

// INTERFACE ÉVÈNEMENT (Modèle de données)
export interface EventType { 
  id: string;
  title: string;
  description: string;
  eventDate: string;
  venue: string;
  price: number;
  availableSeats: number;
  totalSeats: number;
  status: string;
  creatorId?: string;
}

export default function Home() { // Définition de la page d'Accueil
  // ÉTATS 
  const [events, setEvents] = useState<EventType[]>([]); // Liste complète des évènements
  const [loading, setLoading] = useState(true); // Témoin de chargement initial
  const [searchTerm, setSearchTerm] = useState(''); // Contenu de la barre de recherche

  /**
   * Récupère la liste des évènements depuis le backend via Axios.
   */
  const fetchEvents = async () => {
    try {
      const response = await api.get('/events'); // Appel GET /events sur la Gateway
      // Tolérance sur la forme de la réponse (data.data ou data directe)
      setEvents(response.data.data || response.data || []); 
    } catch (err) {
      console.error('Failed to fetch events', err);
    } finally {
      setLoading(false);
    }
  };

  // Effet de montage : Déclenche le premier chargement
  useEffect(() => { 
    fetchEvents(); 
  }, []); // [] = une seule fois

  /**
   * Filtrage des évènements CÔTÉ CLIENT.
   * Filtre sur le Titre ou le Lieu en ignorant la casse (Minuscules).
   */
  const filteredEvents = events.filter((e) =>
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.venue.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return ( // Rendu
    <div>
      {/* SECTION HERO (Bannière d'accueil) */}
      <section className="relative pt-16 pb-20 overflow-hidden mesh-bg">
        {/* Lueur d'ambiance décorative statique */}
        <div
          className="absolute top-1/2 right-0 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(232,167,48,0.04) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-2xl">
          <div className="label-sol mb-6 animate-fade-in">Billetterie en ligne</div>

          <h1 className="font-display font-black leading-[0.88] tracking-tight mb-8 animate-fade-up">
            <span className="block text-[clamp(3.5rem,9vw,7.5rem)] text-noir-50">
              Vivez
            </span>
            <span className="block text-[clamp(3.5rem,9vw,7.5rem)] text-noir-50">
              la musique,
            </span>
            <span
              className="block text-[clamp(3.5rem,9vw,7.5rem)] italic"
              style={{ color: '#E8A730' }} // Couleur jaune ambrée
            >
              autrement.
            </span>
          </h1>

          <p className="text-noir-300 text-base font-sans mb-10 max-w-md animate-fade-up stagger-2">
            Réservez vos places de concerts en quelques secondes.
            Expériences exclusives, paiement sécurisé.
          </p>

          {/* BARRE DE RECHERCHE DYNAMIQUE (Client-side) */}
          <div className="relative max-w-lg animate-fade-up stagger-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-noir-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Artiste, lieu, ville..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} // Bind State
              className="input-dark pl-11 h-14 text-base pr-4"
            />
          </div>
        </div>
      </section>

      {/* BANDEAU DÉROULANT (MARQUEE TICKER) */}
      {events.length > 0 && ( // Ne s'affiche que s'il y a de la donnée
        <div className="border-y border-noir-800 py-3 mb-12 overflow-hidden">
          {/* Classe animate-marquee pour le défilement CSS continu */}
          <div className="flex animate-marquee whitespace-nowrap">
            {/* Duplication pour effet de boucle infinie fluide */}
            {[...events, ...events, ...events, ...events].map((event, i) => (
              <span key={i} className="inline-flex items-center gap-3 mx-5 font-mono text-xs text-noir-400">
                <span className="text-sol">◆</span>
                <span className="uppercase tracking-widest">{event.title}</span>
                <span className="text-noir-700">—</span>
                <span className="text-noir-500">{event.venue}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* GRILLE DES ÉVÈNEMENTS */}
      <section>
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <div className="label-dim mb-1">
              {/* Compteur dynamique */}
              {searchTerm ? `${filteredEvents.length} résultat${filteredEvents.length !== 1 ? 's' : ''}` : `${events.length} concert${events.length !== 1 ? 's' : ''}`}
            </div>
            <h2 className="font-display font-semibold text-2xl text-noir-50">
              {searchTerm ? `Résultats pour "${searchTerm}"` : "Événements à l'affiche"}
            </h2>
          </div>
        </div>

        {/* Vue conditionnelle : Chargement / Liste / Vide */}
        {loading ? ( // Cas 1 : Spinner
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-sol" />
            <span className="text-xs font-mono text-noir-400 uppercase tracking-widest">Chargement</span>
          </div>
        ) : filteredEvents.length > 0 ? ( // Cas 2 : Liste de cartes
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEvents.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                onPurchaseSuccess={fetchEvents} // Callback pour rafraîchir en cas d'achat
                animationIndex={index} // Indice d'apparition cascade
              />
            ))}
          </div>
        ) : ( // Cas 3 : Zéro résultat
          <div className="flex flex-col items-center justify-center py-24 card-dark">
            <div className="label-sol mb-3">Aucun résultat</div>
            <p className="text-noir-400 text-sm font-sans">
              Aucun événement ne correspond à votre recherche.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
