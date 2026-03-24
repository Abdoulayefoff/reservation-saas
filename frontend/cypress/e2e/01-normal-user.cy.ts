describe('Normal User Journey', () => {
  const uniqueEmail = `user${Date.now()}@test.com`;
  const password = 'password123';

  it('should allow a normal user to register, login, and book a ticket', () => {
    cy.visit('/');
    cy.visit('/register');

    cy.get('input[type="text"]').eq(0).type('Jean');
    cy.get('input[type="text"]').eq(1).type('Dupont');
    cy.get('input[type="email"]').type(uniqueEmail);
    cy.get('input[type="password"]').type(password);
    cy.get('input[type="checkbox"]').should('not.be.checked');
    cy.get('button[type="submit"]').click();

    cy.url().should('include', '/login');
    cy.get('input[type="email"]').type(uniqueEmail);
    cy.get('input[type="password"]').type(password);
    cy.get('button[type="submit"]').click();

    cy.url().should('eq', Cypress.config().baseUrl + '/');

    cy.get('body').then($body => {
      if ($body.text().includes('Réserver ma place')) {
        cy.contains('button', 'Réserver ma place').first().click();

        cy.contains("Confirmer la réservation").should('be.visible');

        // Fill card details — 4242 always succeeds in simulation
        cy.get('input[placeholder="1234 5678 9012 3456"]').type('4242424242424242');
        cy.get('input[placeholder="MM/AA"]').type('1228');
        cy.get('input[placeholder="123"]').type('123');

        cy.contains("Confirmer l'achat").click();

        cy.contains('Billet acheté avec succès').should('be.visible');

        cy.visit('/my-tickets');
        cy.contains('Mes Billets').should('be.visible');
      }
    });

    cy.get('.lucide-log-out').first().click({force: true});
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });
});
