/**
 * Component test: Admin Inventory
 *
 * [AV-069] v5.5.0 — verifies the inventory page renders the variant table,
 * fetches products on mount, and supports search + filter (all/low/out).
 */

const { setupAdminMocks, makeFetchMock } = require('./helpers');

setupAdminMocks();

const { render, screen, waitFor, fireEvent } = require('@testing-library/react');
const React = require('react');
const AdminInventoryPage = require('@/app/admin/inventory/page').default;

const FIXTURE = {
  products: [
    {
      id: 'p1', name: 'Freedom Tee', slug: 'freedom-tee', status: 'active',
      variants: [
        { id: 'v1', sku: 'TEE-BLK-S', stockQty: 50, color: { name: 'Black' }, size: { name: 'S' } },
        { id: 'v2', sku: 'TEE-BLK-M', stockQty: 3, color: { name: 'Black' }, size: { name: 'M' } },
      ],
    },
    {
      id: 'p2', name: 'Liberty Hoodie', slug: 'liberty-hoodie', status: 'active',
      variants: [
        { id: 'v3', sku: 'HOOD-RED-L', stockQty: 0, color: { name: 'Red' }, size: { name: 'L' } },
      ],
    },
  ],
};

describe('AdminInventoryPage', () => {
  beforeEach(() => {
    global.fetch = makeFetchMock({ ok: true, body: FIXTURE });
  });

  test('renders INVENTORY heading', async () => {
    render(React.createElement(AdminInventoryPage));
    await waitFor(() => expect(screen.getByRole('heading', { name: /inventory/i })).toBeInTheDocument());
  });

  test('fetches admin products on mount', async () => {
    render(React.createElement(AdminInventoryPage));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = global.fetch.mock.calls[0][0];
    expect(url).toMatch(/\/admin\/products$/);
  });

  test('displays variants in the table after data loads', async () => {
    render(React.createElement(AdminInventoryPage));
    await waitFor(() => expect(screen.getByText('TEE-BLK-S')).toBeInTheDocument());
    expect(screen.getByText('TEE-BLK-M')).toBeInTheDocument();
    expect(screen.getByText('HOOD-RED-L')).toBeInTheDocument();
  });

  test('search input filters variants by SKU/product name', async () => {
    render(React.createElement(AdminInventoryPage));
    await waitFor(() => expect(screen.getByText('HOOD-RED-L')).toBeInTheDocument());

    const search = screen.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: 'HOOD' } });

    // Hoodie variant remains; tee variants gone
    expect(screen.getByText('HOOD-RED-L')).toBeInTheDocument();
    expect(screen.queryByText('TEE-BLK-S')).not.toBeInTheDocument();
  });

  test('shows error state when fetch fails', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network down')));
    render(React.createElement(AdminInventoryPage));
    await waitFor(() => expect(screen.getByText(/network down|failed|error/i)).toBeInTheDocument());
  });
});
