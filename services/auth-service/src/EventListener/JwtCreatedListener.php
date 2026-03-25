<?php 

declare(strict_types=1); 
namespace App\EventListener; 
use App\Entity\User; 
use Lexik\Bundle\JWTAuthenticationBundle\Event\JWTCreatedEvent; 
use Symfony\Component\EventDispatcher\Attribute\AsEventListener; 

/**
 * Écouteur (Listener) de l'évènement de création du jeton JWT.
 * 
 * Ajoute le UUID de l'utilisateur dans le payload (corps) du JWT.
 *
 * Par défaut, LexikJWT ne met que l'email (user_id_claim) et les rôles.
 * L'API Gateway a besoin du vrai UUID pour lier les données inter-services.
 */
#[AsEventListener(event: 'lexik_jwt_authentication.on_jwt_created')] // Branche la méthode sur l'évènement de Lexik
class JwtCreatedListener 
{ 

    /**
     * Méthode invoquée automatiquement à l'appel de l'évènement.
     */
    public function __invoke(JWTCreatedEvent $event): void 
    { 
        $user = $event->getUser(); // Récupère l'objet utilisateur concerné par la création du jeton

        // Vérification de sécurité : s'assure que l'utilisateur est bien une instance de notre classe User
        if (!$user instanceof User) {
            return; 
        } 

        $payload = $event->getData(); // Récupère le tableau des données (payload) actuel du JWT
        
        // Ajout de l'identifiant unique (UUID) dans le payload
        $payload['userId'] = (string) $user->getId();

        $event->setData($payload); 
    } 
} 
