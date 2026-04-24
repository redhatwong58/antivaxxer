/**
 * Component test: Admin Promos
 *
 * [AV-069] v5.5.0 — verifies the promos page renders, fetches promos,
 * and shows the promo list with formatted values.
 */

const { setupAdminMocks, makeFetchMock } = require('./helpers');

setupAdminMocks();

const { render, screen, waitFor } = require('@testing-library/react');
const React = require('react');
const AdminPromosPage = require('@/app/admin/promos/page').default;

const FIXTURE = {
  promos: [
    {
      id: 'pr1', code: 'WELCOME10', type: 'percentage', value: 10,
      isActive: true, maxUses: 100, currentUses: 5, maxUsesPerUser: 1,
      minSubtotal: 0, expiresAt: null, createdAt: '2026-04-01T00:00:00Z',
    },
    {
      id: 'pr2', code: 'FREESHIP', type: 'free_shipping', value: 0,
      isActive: true, maxUses: null, currentUses: 12, maxUsesPerUser: 1,
      minSubtotal: 50, expiresAt: null, createdAt: '2026-04-05T00:00:00Z',
    },
    {
      id: 'pr3', code: 'OLD20', type: 'fixed_amount', value: 20,
      isActive: false, maxUses: 50, currentUses: 50, maxUsesPerUser: 1,
      minSubtotal: 0, expiresAt: '2026-03-01T00:00:00Z', createdAt: '2026-02-01T00:00:00Z',
    },
  ],
};

describe('AdminPromosPage', () => {
  beforeEach(() => {
    global.fetch = makeFetchMock({ ok: true, body: FIXTURE });
  });

  test('renders PROMO CODES heading', async () => {
    render(React.createElement(AdminPromosPage));
    await waitFor(() => expect(screen.getByRole('heading', { name: /promo codes/i })).toBeInTheDocument());
  });

  test('fetches promos on mount', async () => {
    render(React.createElement(AdminPromosPage));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = global.fetch.mock.calls[0][0];
    expect(url).toMatch(/\/admin\/promos$/);
  });

  test('displays all promo codes', async () => {
    render(React.createElement(AdminPromosPage));
    await waitFor(() => expect(screen.getByText('WELCOME10')).toBeInTheDocument());
    expect(screen.getByText('FREESHIP')).toBeInTheDocument();
    expect(screen.getByText('OLD20')).toBeInTheDocument();
  });

  test('formats percentage promo value with %', async () => {
    render(React.createElement(AdminPromosPage));
    await waitFor(() => expect(screen.getByText('10%')).toBeInTheDocument());
  });

  test('formats fixed_amount promo value with $', async () => {
    render(React.createElement(AdminPromosPage));
    await waitFor(() => expect(screen.getByText('$20.00')).toBeInTheDocument());
  });

  test('shows error state when fetch fails', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network down')));
    render(React.createElement(AdminPromosPage));
    await waitFor(() => expect(screen.getByText(/network down|failed|error/i)).toBeInTheDocument());
  });
});
