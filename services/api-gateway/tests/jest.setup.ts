// Ce fichier s'exécute AVANT le chargement de tout module de test (setupFiles).
// Il garantit que NODE_ENV=test est défini avant que app.ts soit importé, évitant ainsi le démarrage du serveur HTTP (app.listen) pendant les tests.
process.env.NODE_ENV = 'test';

// Désactiver JWT_PUBLIC_KEY pour forcer le fallback HS256 dans les tests unitaires.
// Les tests signent les tokens avec JWT_SECRET (HS256), pas avec la clé RSA du conteneur Docker (qui utilise RS256 en production).
delete process.env.JWT_PUBLIC_KEY;
