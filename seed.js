#!/usr/bin/env node
/**
 * seed.js — Peuplement complet de la base de données via l'API Gateway
 *
 * Usage : node seed.js [--base-url http://localhost:8000]
 *
 * Ce script crée via les vrais endpoints REST :
 *   1. Utilisateurs (admin, organisateurs, clients)
 *   2. Événements avec options de billetterie
 *   3. Achats de billets
 *
 * Toutes les données passent par l'API Gateway (port 8000),
 * ce qui peuple automatiquement auth-db, user-db, event-db et ticket-db.
 */

const BASE_URL = process.argv.includes('--base-url')
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : 'http://localhost:8000/api';

// Helpers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    console.error(`  ✗ ${method} ${path} → ${res.status}`, typeof data === 'object' ? JSON.stringify(data) : data);
    return null;
  }
  return data;
}

function log(msg) { console.log(`\n${'─'.repeat(60)}\n${msg}\n${'─'.repeat(60)}`); }
function ok(msg)  { console.log(`  ✓ ${msg}`); }
function warn(msg){ console.log(`  ⚠ ${msg}`); }

// Données

const USERS = [
  {
    firstName: 'admin',
    lastName:  'Administrateur',
    email:     'admin.admin@ticketsaas.fr',
    password:  'Admin1234!',
    roles:     ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_EVENT_CREATOR'],
    label:     'Admin',
  },
  {
    firstName: 'Abdoulaye',
    lastName:  'Organisateur',
    email:     'abdoulaye.orga@ticketsaas.fr',
    password:  'Orga1234!',
    roles:     ['ROLE_USER', 'ROLE_EVENT_CREATOR'],
    label:     'Organisateur #1',
  },
  {
    firstName: 'Ayman',
    lastName:  'Productrice',
    email:     'ayman.prod@ticketsaas.fr',
    password:  'Orga1234!',
    roles:     ['ROLE_USER', 'ROLE_EVENT_CREATOR'],
    label:     'Organisateur #2',
  },
  {
    firstName: 'Client1',
    lastName:  'User',
    email:     'client1.client@mail.fr',
    password:  'User1234!',
    roles:     ['ROLE_USER'],
    label:     'Client #1',
  },
  {
    firstName: 'Client2',
    lastName:  'User',
    email:     'client2.client@mail.fr',
    password:  'User1234!',
    roles:     ['ROLE_USER'],
    label:     'Client #2',
  },
  {
    firstName: 'Client3', 
    lastName:  'User',
    email:     'client3.client@mail.fr',
    password:  'User1234!',
    roles:     ['ROLE_USER'],
    label:     'Client #3',
  },
];

// Événements créés par les organisateurs (organisateur index dans USERS)
const EVENTS_DATA = [
  {
    creatorIndex: 1, // abdoulaye
    event: {
      title:       'Festival de Jazz de Paris 2026',
      description: "Le plus grand festival de jazz de France revient pour une édition exceptionnelle. Trois jours de concerts avec des artistes internationaux sur 5 scènes au cœur de Paris.",
      date:        '2026-07-15T19:00:00.000Z',
      venue:       'Parc de la Villette, Paris',
      price:       45,
      totalSeats:  800,
      status:      'PUBLISHED',
    },
    ticketOptions: [
      { type: 'Accès 1 jour',     price: 45,  quantity: 400 },
      { type: 'Pass 3 jours',     price: 110, quantity: 300 },
      { type: 'VIP – Lounge',     price: 220, quantity: 100 },
    ],
  },
  {
    creatorIndex: 1, // abdoulaye
    event: {
      title:       'Soirée Électro – Grand Rex',
      description: "Une nuit électrisante avec les meilleurs DJs de la scène techno et house européenne. Le Grand Rex se transforme en club d'exception pour une seule et unique nuit.",
      date:        '2026-06-20T22:00:00.000Z',
      venue:       'Le Grand Rex, Paris',
      price:       35,
      totalSeats:  2700,
      status:      'PUBLISHED',
    },
    ticketOptions: [
      { type: 'Standard',         price: 35,  quantity: 2000 },
      { type: 'Early Access',     price: 25,  quantity: 500  },
      { type: 'VIP Table',        price: 150, quantity: 200  },
    ],
  },
  {
    creatorIndex: 2, // ayman
    event: {
      title:       'Comedy Night – Stand-Up Parisien',
      description: "Une soirée stand-up avec 6 humoristes confirmés et 2 invités surprises. Rires garantis dans la salle la plus mythique de Montmartre.",
      date:        '2026-05-10T20:30:00.000Z',
      venue:       "Théâtre de Dix Heures, Montmartre",
      price:       28,
      totalSeats:  250,
      status:      'PUBLISHED',
    },
    ticketOptions: [
      { type: 'Standard',         price: 28,  quantity: 200 },
      { type: 'Premium Front',    price: 45,  quantity: 50  },
    ],
  },
  {
    creatorIndex: 2, // ayman
    event: {
      title:       'Concert Classique – Salle Pleyel',
      description: "L'Orchestre de Paris interprète Mahler et Debussy sous la direction du maestro Stefan Reck. Une soirée d'exception dans l'une des plus belles salles de concert au monde.",
      date:        '2026-09-28T20:00:00.000Z',
      venue:       'Salle Pleyel, Paris',
      price:       55,
      totalSeats:  1900,
      status:      'PUBLISHED',
    },
    ticketOptions: [
      { type: 'Catégorie 3',      price: 55,  quantity: 800 },
      { type: 'Catégorie 2',      price: 80,  quantity: 700 },
      { type: 'Catégorie 1',      price: 120, quantity: 300 },
      { type: 'Carré Or',         price: 180, quantity: 100 },
    ],
  },
  {
    creatorIndex: 1, // abdoulaye
    event: {
      title:       'Rock en Seine 2026',
      description: "Le festival rock incontournable de l'été parisien. 4 jours de concerts avec plus de 50 artistes sur 4 scènes dans le magnifique Domaine National de Saint-Cloud.",
      date:        '2026-08-27T12:00:00.000Z',
      venue:       'Domaine National de Saint-Cloud',
      price:       69,
      totalSeats:  5000,
      status:      'PUBLISHED',
    },
    ticketOptions: [
      { type: 'Pass 1 jour',      price: 69,  quantity: 2000 },
      { type: 'Pass 4 jours',     price: 199, quantity: 2500 },
      { type: 'Camping Pass',     price: 249, quantity: 400  },
      { type: 'VIP Expérience',   price: 399, quantity: 100  },
    ],
  },
  {
    creatorIndex: 2, // ayman
    event: {
      title:       'Exposition Immersive – Van Gogh',
      description: "Plongez dans l'univers de Van Gogh grâce à une expérience immersive 360° inédite. Plus de 300 œuvres projetées sur 3000 m² d'espace numérique.",
      date:        '2026-04-15T10:00:00.000Z',
      venue:       'La Grande Halle de la Villette, Paris',
      price:       18,
      totalSeats:  500,
      status:      'PUBLISHED',
    },
    ticketOptions: [
      { type: 'Adulte',           price: 18,  quantity: 350 },
      { type: 'Enfant (–12 ans)', price: 10,  quantity: 100 },
      { type: 'Famille (2+2)',    price: 50,  quantity: 50  },
    ],
  },
  {
    creatorIndex: 1, // abdoulaye
    event: {
      title:       'Soirée Gala Caritatif 2026',
      description: "Gala annuel au profit de l'association Enfants du Monde. Dîner de prestige, vente aux enchères et concert privé.",
      date:        '2026-11-14T19:30:00.000Z',
      venue:       'Hôtel Plaza Athénée, Paris',
      price:       350,
      totalSeats:  100,
      status:      'DRAFT', // brouillon volontaire
    },
    ticketOptions: [
      { type: 'Table Individuelle', price: 350, quantity: 80 },
      { type: 'Table Prestige',     price: 600, quantity: 20 },
    ],
  },
];

// Plans d'achat : [userIndex, eventIndex, quantity]
const PURCHASE_PLANS = [
  [3, 0, 2],  // Client1 achète 2 billets Festival Jazz
  [3, 1, 1],  // Client1 achète 1 billet Soirée Électro
  [4, 0, 1],  // Client2 achète 1 billet Festival Jazz
  [4, 2, 2],  // Client2 achète 2 billets Comedy Night
  [4, 4, 1],  // Client2 achète 1 billet Rock en Seine
  [5, 1, 3],  // Client3 achète 3 billets Soirée Électro
  [5, 3, 2],  // Client3 achète 2 billets Concert Classique
  [5, 5, 4],  // Client3 achète 4 billets Expo Van Gogh
  [3, 4, 1],  // Client1 achète 1 billet Rock en Seine
  [4, 3, 1],  // Client2 achète 1 billet Concert Classique
];

// Étape 1 : Inscription des utilisateurs

async function seedUsers() {
  log('ÉTAPE 1 — Inscription des utilisateurs');
  const tokens = {};
  const userIds = {};

  for (const u of USERS) {
    const res = await request('POST', '/auth/register', {
      firstName: u.firstName,
      lastName:  u.lastName,
      email:     u.email,
      password:  u.password,
      roles:     u.roles,
    });

    if (res) {
      ok(`${u.label} créé → ${u.email}`);
    } else {
      warn(`${u.label} existe déjà ou erreur, tentative de login…`);
    }

    // Login pour récupérer le token
    await sleep(200);
    const login = await request('POST', '/auth/login', { email: u.email, password: u.password });
    if (!login?.token) {
      console.error(`  ✗ Impossible de se connecter en tant que ${u.email}`);
      continue;
    }

    tokens[u.email] = login.token;

    // Récupérer l'ID utilisateur depuis le JWT
    const payload = JSON.parse(Buffer.from(login.token.split('.')[1], 'base64').toString());
    userIds[u.email] = payload.userId;

    ok(`Token obtenu pour ${u.label} (id: ${payload.userId})`);
  }

  return { tokens, userIds };
}

// Étape 2 : Création des événements & options

async function seedEvents(tokens) {
  log('ÉTAPE 2 — Création des événements');
  const eventIds = [];

  for (const item of EVENTS_DATA) {
    const creator = USERS[item.creatorIndex];
    const token   = tokens[creator.email];
    if (!token) { warn(`Pas de token pour ${creator.email}, événement ignoré.`); continue; }

    // Créer l'événement
    const created = await request('POST', '/events', item.event, token);
    if (!created?.id) { warn(`Échec création "${item.event.title}"`); eventIds.push(null); continue; }

    ok(`Événement créé : "${item.event.title}" (id: ${created.id})`);

    // Ajouter les options de billetterie
    for (const opt of item.ticketOptions) {
      await sleep(100);
      const optRes = await request('POST', `/events/${created.id}/ticket-options`, opt, token);
      if (optRes?.id) {
        ok(`  Option "${opt.type}" → ${opt.price}€ × ${opt.quantity} places`);
      }
    }

    eventIds.push(created.id);
  }

  return eventIds;
}

// Étape 3 : Achat de billets

async function seedTickets(tokens, eventIds) {
  log('ÉTAPE 3 — Achat de billets');

  for (const [userIdx, eventIdx, qty] of PURCHASE_PLANS) {
    const user    = USERS[userIdx];
    const token   = tokens[user.email];
    const eventId = eventIds[eventIdx];

    if (!token || !eventId) {
      warn(`Skip achat : user=${user.label}, event idx=${eventIdx}`);
      continue;
    }

    await sleep(300); // Laisser le service respirer entre les achats

    let retries = 3;
    let res = null;
    while (retries-- > 0) {
      res = await request('POST', '/tickets/buy', { eventId, quantity: qty }, token);
      if (res) break;
      await sleep(500); // Paiement simulé peut échouer (90% succès) — on réessaie
    }
    if (res) {
      const tickets = res.tickets || (Array.isArray(res) ? res : [res]);
      const ids = tickets.map(t => t.id?.slice(0, 8)).join(', ');
      ok(`${user.label} achète ${qty} billet(s) → event[${eventIdx}] | ticket(s): ${ids}`);
    } else {
      warn(`${user.label} → achat échoué après 3 tentatives (event[${eventIdx}])`);
    }
  }
}

// Étape 4 : Vérification finale

async function verifySeeding(tokens) {
  log('ÉTAPE 4 — Vérification');

  // Compter les événements publiés
  const eventsRes = await request('GET', '/events');
  const events    = eventsRes?.data || eventsRes || [];
  ok(`${Array.isArray(events) ? events.length : '?'} événement(s) publié(s) visible(s)`);

  // Compter les billets pour chaque client
  for (const u of USERS.filter(u => u.roles.includes('ROLE_USER') && !u.roles.includes('ROLE_EVENT_CREATOR') && !u.roles.includes('ROLE_ADMIN'))) {
    const token   = tokens[u.email];
    if (!token) continue;
    const tickets = await request('GET', '/tickets', null, token);
    const count   = Array.isArray(tickets) ? tickets.length : (tickets?.data?.length ?? '?');
    ok(`${u.firstName} ${u.lastName} → ${count} billet(s)`);
  }
}

// Main 

async function main() {
  console.log('\n🌱  SEED — Réservation SaaS');
  console.log(`   API Gateway : ${BASE_URL}\n`);

  // Vérifier que l'API est disponible
  try {
    const ping = await fetch(`${BASE_URL}/events`);
    if (!ping.ok && ping.status !== 401) throw new Error(`Status ${ping.status}`);
  } catch (err) {
    console.error(`\n✗ API Gateway inaccessible (${BASE_URL})\n  → Assurez-vous que les containers sont démarrés : docker compose up -d\n`);
    process.exit(1);
  }

  try {
    const { tokens } = await seedUsers();
    const eventIds   = await seedEvents(tokens);
    await seedTickets(tokens, eventIds);
    await verifySeeding(tokens);

    console.log('\n✅  Seed terminé avec succès !\n');
    console.log('Comptes créés :');
    USERS.forEach(u => console.log(`  ${u.label.padEnd(20)} ${u.email}  /  ${u.password}`));
    console.log();
  } catch (err) {
    console.error('\n✗ Erreur inattendue :', err.message);
    process.exit(1);
  }
}

main();
