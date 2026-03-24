describe('Admin Journey', () => {
  const adminEmail = `admin${Date.now()}@test.com`;
  const password = 'password123';

  before(() => {
    cy.request({
      method: 'POST',
      url: '/api/auth/register',
      failOnStatusCode: false,
      body: {
        firstName: 'Admin',
        lastName: 'System',
        email: adminEmail,
        password: password,
        roles: ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_EVENT_CREATOR']
      }
    });
  });

  it('should allow an admin to login and access the organizer/admin dashboard', () => {
    cy.visit('/login');

    cy.get('input[type="email"]').type(adminEmail);
    cy.get('input[type="password"]').type(password);
    cy.get('button[type="submit"]').click();

    cy.url().should('eq', Cypress.config().baseUrl + '/');

    cy.visit('/dashboard');

    // Admin sees "Dashboard Admin", organizer sees "Dashboard Organisateur"
    cy.contains('Dashboard').should('be.visible');
    cy.contains('Créer un événement').should('be.visible');
    cy.contains('Aucun événement').should('be.visible');

    cy.visit('/profile');
    cy.contains('Profil').should('be.visible');
    cy.contains(adminEmail).should('be.visible');

    cy.get('.lucide-log-out').first().click({force: true});
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });
});
