describe('Event Creator Journey', () => {
  const uniqueEmail = `orga${Date.now()}@test.com`;
  const password = 'password123';

  it('should allow an organizer to register, login, and create an event', () => {
    // 1. Visit Register Page
    cy.visit('/register');

    // 2. Fill the registration form
    cy.get('input[type="text"]').eq(0).type('Paul'); // Prénom
    cy.get('input[type="text"]').eq(1).type('Createur'); // Nom
    cy.get('input[type="email"]').type(uniqueEmail); // Email
    cy.get('input[type="password"]').type(password); // Mot de passe
    
    // Ensure the organizer checkbox is CHECKED
    cy.get('input[type="checkbox"]').check();

    // Submit registration
    cy.get('button[type="submit"]').click();

    // 3. Login
    cy.url().should('include', '/login');
    cy.get('input[type="email"]').type(uniqueEmail);
    cy.get('input[type="password"]').type(password);
    cy.get('button[type="submit"]').click();

    // 4. Navigate to Dashboard
    cy.url().should('eq', Cypress.config().baseUrl + '/');
    
    // There should be a link to Dashboard in the navigation when logged in as organizer
    // Alternatively, just visit /dashboard directly since our routes allow it
    cy.visit('/dashboard');

    // 5. Create new event
    cy.contains('button', 'Créer un événement').click();

    // The modal should appear
    cy.contains('h2', 'Créer un événement').should('be.visible');

    // Fill event details
    cy.contains('label', "Titre de l'événement").next('input').type('Cypress Test Concert');
    cy.contains('label', 'Description').next('textarea').type('Concert rock de test généré par Cypress');
    
    // Date: format for datetime-local is YYYY-MM-DDThh:mm
    // Let's set it to some future date (e.g., 2026-12-31T20:00)
    cy.contains('label', 'Date et heure').next('input').type('2026-12-31T20:00');
    cy.contains('label', 'Lieu').next('input').type('Stade de France');

    // Prices and Capacity
    cy.contains('label', 'Prix (€)').next('input').clear().type('45');
    cy.contains('label', 'Capacité').next('input').clear().type('500');

    // Submit
    cy.contains('button', "Créer l'événement").click();

    // Wait for success toast
    cy.contains('Événement créé avec succès').should('be.visible');

    // Make sure the event appears in the table
    cy.contains('td', 'Cypress Test Concert').should('be.visible');
    cy.contains('td', 'Stade de France').should('be.visible');
  });
});
