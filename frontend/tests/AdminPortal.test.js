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

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        courses: [
          {
            id: 1,
            title: 'AWS',
            description: 'Cloud fundamentals',
            videos: [{ id: 11, title: 'AWS Intro', videoUrl: 'https://example.com/aws' }],
          },
        ],
        users: [
          {
            id: 2,
            username: 'learner1',
            fullName: 'Learner One',
            role: 'user',
            courses: [{ id: 1, title: 'AWS' }],
          },
        ],
      }),
    });
  });

  test('renders admin dashboard data from the API', async () => {
    render(
      <MemoryRouter>
        <AdminPortal />
      </MemoryRouter>
    );

    expect(await screen.findByText(/admin control center/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'AWS' })).toBeInTheDocument();
    expect(await screen.findByText('Learner One')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create course/i })).toBeInTheDocument();
  });
});

