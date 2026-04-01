import { render, screen } from '@testing-library/react';
import App from '../src/App';
import { AUTH_STORAGE_KEY } from '../src/lib/api';

describe('App routing', () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.fetch = jest.fn();
  });

  test('renders the login page at the root path', () => {
    globalThis.window.history.pushState({}, '', '/');
    render(<App />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('renders the admin route when saved admin auth is available', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'admin-token',
        user: { username: 'admin', fullName: 'Default Admin', role: 'admin' },
      })
    );

    globalThis.fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ courses: [], users: [] }),
    });

    globalThis.window.history.pushState({}, '', '/admin');
    render(<App />);

    expect(await screen.findByText(/admin console/i)).toBeInTheDocument();
  });
});

