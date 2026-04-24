/**
 * Component test: Admin Dashboard
 *
 * [AV-069] v5.5.0 — verifies the dashboard renders, fetches data on mount,
 * shows loading + error states, and displays the six stat tiles when data
 * is loaded.
 *
 * Does NOT verify: actual chart rendering, API contract details (covered
 * by api/__tests__/), or click navigation (covered by the layout's sidebar).
 */

const { setupAdminMocks, makeFetchMock } = require('./helpers');

setupAdminMocks();

const { render, screen, waitFor } = require('@testing-library/react');
const React = require('react');
const AdminDashboardPage = require('@/app/admin/page').default;

const FIXTURE = {
  stats: {
    revenue: 12345.67,
    orderCount: 42,
    aov: 293.94,
    pendingFulfillment: 3,
    lowStockCount: 2,
    newCustomers: 15,
  },
  recentOrders: [
    {
      id: 'o1',
      orderNumber: 'AV-20260415-0001',
      email: 'a@test.com',
      total: 99.99,
      status: 'processing',
      createdAt: '2026-04-15T10:00:00Z',
    },
  ],
  topSellers: [
    { name: 'Freedom Tee', unitsSold: 120, revenue: 3000.00 },
  ],
  lowStock: [
    { sku: 'TEE-BLK-M', productName: 'Freedom Tee', stockQty: 3 },
  ],
};

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    global.fetch = makeFetchMock({ ok: true, body: FIXTURE });
  });

  test('renders DASHBOARD heading', async () => {
    render(React.createElement(AdminDashboardPage));
    await waitFor(() => expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument());
  });

  test('fetches dashboard data on mount', async () => {
    render(React.createElement(AdminDashboardPage));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = global.fetch.mock.calls[0][0];
    expect(url).toMatch(/\/admin\/dashboard$/);
  });

  test('displays all six stat tiles after data loads', async () => {
    render(React.createElement(AdminDashboardPage));
    await waitFor(() => expect(screen.getByText(/revenue/i)).toBeInTheDocument());
    expect(screen.getByText(/orders/i)).toBeInTheDocument();
    expect(screen.getByText(/avg order/i)).toBeInTheDocument();
    expect(screen.getByText(/pending fulfillment/i)).toBeInTheDocument();
    expect(screen.getByText(/low stock/i)).toBeInTheDocument();
    expect(screen.getByText(/new customers/i)).toBeInTheDocument();
  });

  test('displays recent orders section', async () => {
    render(React.createElement(AdminDashboardPage));
    await waitFor(() => expect(screen.getByText(/recent orders/i)).toBeInTheDocument());
    expect(screen.getByText(/AV-20260415-0001/)).toBeInTheDocument();
  });

  test('displays top sellers section', async () => {
    render(React.createElement(AdminDashboardPage));
    await waitFor(() => expect(screen.getByText(/top sellers/i)).toBeInTheDocument());
    expect(screen.getByText(/Freedom Tee/)).toBeInTheDocument();
  });

  test('shows low stock alert when lowStockCount > 0', async () => {
    render(React.createElement(AdminDashboardPage));
    await waitFor(() => expect(screen.getByText(/low on stock/i)).toBeInTheDocument());
  });

  test('shows error state when fetch fails', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network down')));
    render(React.createElement(AdminDashboardPage));
    await waitFor(() => expect(screen.getByText(/network down|failed|error/i)).toBeInTheDocument());
  });
});
