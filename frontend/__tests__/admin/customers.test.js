/**
 * Component test: Admin Customers
 *
 * [AV-069] v5.5.0 — verifies the customer list page renders, fetches
 * customers, displays the customer table with key columns, and shows
 * search/empty states correctly.
 */

const { setupAdminMocks, makeFetchMock } = require('./helpers');

setupAdminMocks();

const { render, screen, waitFor } = require('@testing-library/react');
const React = require('react');
const AdminCustomersPage = require('@/app/admin/customers/page').default;

const FIXTURE = {
  customers: [
    {
      id: 'c1', name: 'Alex Rivera', email: 'alex@example.com',
      orderCount: 5, lifetimeSpend: 234.56, joined: '2026-02-15T10:00:00Z',
    },
    {
      id: 'c2', name: 'Sam Lee', email: 'sam@example.com',
      orderCount: 1, lifetimeSpend: 49.99, joined: '2026-04-01T14:30:00Z',
    },
  ],
};

describe('AdminCustomersPage', () => {
  beforeEach(() => {
    global.fetch = makeFetchMock({ ok: true, body: FIXTURE });
  });

  test('renders CUSTOMERS heading', async () => {
    render(React.createElement(AdminCustomersPage));
    await waitFor(() => expect(screen.getByRole('heading', { name: /customers/i })).toBeInTheDocument());
  });

  test('fetches customers on mount', async () => {
    render(React.createElement(AdminCustomersPage));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = global.fetch.mock.calls[0][0];
    expect(url).toMatch(/\/admin\/customers/);
  });

  test('displays customer table with name + email + orders + lifetime spend', async () => {
    render(React.createElement(AdminCustomersPage));
    await waitFor(() => expect(screen.getByText('Alex Rivera')).toBeInTheDocument());
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('Sam Lee')).toBeInTheDocument();
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    expect(screen.getByText('$234.56')).toBeInTheDocument();
    expect(screen.getByText('$49.99')).toBeInTheDocument();
  });

  test('displays View link to customer detail page', async () => {
    render(React.createElement(AdminCustomersPage));
    await waitFor(() => expect(screen.getByText('Alex Rivera')).toBeInTheDocument());
    const links = screen.getAllByText(/view/i);
    expect(links.length).toBeGreaterThanOrEqual(2); // one per customer
  });

  test('shows empty state when no customers', async () => {
    global.fetch = makeFetchMock({ ok: true, body: { customers: [] } });
    render(React.createElement(AdminCustomersPage));
    await waitFor(() => expect(screen.getByText(/no customers yet/i)).toBeInTheDocument());
  });

  test('shows error state when fetch fails', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network down')));
    render(React.createElement(AdminCustomersPage));
    await waitFor(() => expect(screen.getByText(/network down|failed|error/i)).toBeInTheDocument());
  });
});
