import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPortal from '../src/components/AdminPortal';
import { AUTH_STORAGE_KEY } from '../src/lib/api';

describe('AdminPortal', () => {
  beforeEach(() => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'admin-token',
        user: { username: 'admin', fullName: 'Default Admin', role: 'admin' },
      })
    );

    globalThis.fetch = jest.fn().mockImplementation(async (url) => {
      const asString = String(url);
      if (asString.includes('/admin/dashboard')) {
        return {
          ok: true,
          text: async () => JSON.stringify({
            courses: [{ id: 1, title: 'AWS', description: 'Cloud fundamentals', videoCount: 1 }],
            users: [{ id: 2, username: 'learner1', fullName: 'Learner One', role: 'user' }],
          }),
        };
      }
      if (asString.includes('/admin/learners')) {
        return {
          ok: true,
          text: async () => JSON.stringify({
            learners: [{ id: 2, username: 'learner1', fullName: 'Learner One', email: 'l1@example.com', role: 'user' }],
            pagination: { page: 1, pageSize: 10, total: 1 },
          }),
        };
      }
      return { ok: true, text: async () => JSON.stringify({}) };
    });
  });

  test('renders admin dashboard data from the API', async () => {
    render(
      <MemoryRouter>
        <AdminPortal />
      </MemoryRouter>
    );

    expect(await screen.findByText(/admin dashboard/i)).toBeInTheDocument();
    // Learners list is now backend-paginated and loaded when on Learner Management tab.
    expect(screen.getByRole('button', { name: /course management/i })).toBeInTheDocument();
  });
});

