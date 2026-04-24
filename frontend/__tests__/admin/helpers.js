/**
 * Shared test helpers for admin component tests
 *
 * [AV-069] v5.5.0 — every admin page uses useAdminAuth() (which depends on
 * NextAuth + sessionStorage + Next router) and fetch(). Mocking those
 * primitives once here keeps each spec focused on the page's actual behavior.
 */

// ----- Admin auth mock -----
// All admin pages call useAdminAuth() which returns { ready, getHeaders }.
// Setting ready=true skips the auth-check effect and lets the page fetch.
function mockAdminAuth(ready = true) {
  jest.doMock('@/lib/adminAuth', () => ({
    useAdminAuth: () => ({
      ready,
      session: ready ? { user: { id: 'test-admin', role: 'admin', apiToken: 'test-jwt' } } : null,
      getHeaders: () => (ready ? { Authorization: 'Bearer test-jwt' } : {}),
    }),
  }));
}

// ----- Next.js Link mock -----
// next/link wraps children in <a>. Tests don't need real navigation;
// a passthrough is enough.
function mockNextLink() {
  jest.doMock('next/link', () => ({
    __esModule: true,
    default: ({ children, href, ...props }) => {
      const React = require('react');
      return React.createElement('a', { href, ...props }, children);
    },
  }));
}

// ----- Next.js router mock -----
function mockNextRouter() {
  jest.doMock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
    usePathname: () => '/admin',
    useSearchParams: () => new URLSearchParams(),
  }));
}

// ----- next-auth/react mock -----
// useAdminAuth() depends on useSession() from next-auth/react. Even though
// our mockAdminAuth replaces useAdminAuth wholesale, some admin pages also
// import useSession directly (e.g. for displaying the admin's name in the
// sidebar). Mock it defensively so any direct import works too.
function mockNextAuth() {
  jest.doMock('next-auth/react', () => ({
    useSession: () => ({
      data: { user: { id: 'test-admin', name: 'Test Admin', role: 'admin', apiToken: 'test-jwt' } },
      status: 'authenticated',
    }),
    signIn: jest.fn(),
    signOut: jest.fn(),
  }));
}

// ----- Apply all admin-page mocks -----
function setupAdminMocks() {
  mockAdminAuth(true);
  mockNextLink();
  mockNextRouter();
  mockNextAuth();
}

// ----- fetch mock factory -----
// Returns a jest.fn() that resolves to the given JSON body with status 200.
// Pass an array of responses to handle multi-call sequences.
function makeFetchMock(responses) {
  const list = Array.isArray(responses) ? [...responses] : [responses];
  return jest.fn(() => {
    const next = list.shift() || { ok: true, json: async () => ({}) };
    return Promise.resolve({
      ok: next.ok !== false,
      status: next.status || 200,
      json: async () => next.body || next,
    });
  });
}

module.exports = {
  setupAdminMocks,
  mockAdminAuth,
  mockNextLink,
  mockNextRouter,
  mockNextAuth,
  makeFetchMock,
};
