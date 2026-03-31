import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FrontPage from '../src/components/FrontPage';
import { AUTH_STORAGE_KEY } from '../src/lib/api';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('FrontPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    globalThis.fetch = jest.fn();
  });

  test('shows API error for wrong credentials', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ message: 'Invalid username or password.' }),
    });

    render(
      <MemoryRouter>
        <FrontPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText(/enter your username/i), 'notadmin');
    await userEvent.type(screen.getByPlaceholderText(/enter your password/i), 'bad');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument();
  });

  test('stores auth and navigates to /admin after successful login', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        token: 'sample-token',
        user: {
          username: 'admin',
          fullName: 'Default Admin',
          role: 'admin',
        },
      }),
    });

    render(
      <MemoryRouter>
        <FrontPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText(/enter your username/i), 'admin');
    await userEvent.type(screen.getByPlaceholderText(/enter your password/i), 'admin');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin');
    });

    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY))).toMatchObject({
      token: 'sample-token',
      user: { username: 'admin', role: 'admin' },
    });
  });
});

