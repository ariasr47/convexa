// Trivial smoke e2e — proves the app shell boots and the e2e target is real. Feature e2e flows are
// deferred to nearer go-live per the testing rule. No backend is required: the Convexa AppBar renders
// client-side before any data loads (the dashboard below it just shows a loading state).
describe('app shell', () => {
  it('loads', () => {
    cy.visit('/');
    cy.contains('Convexa').should('be.visible');
  });
});
