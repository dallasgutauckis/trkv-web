import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { toast } from 'react-hot-toast';
import VIPList from '../vip-list';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: {
      accessToken: 'mock-token',
    },
    status: 'authenticated',
    update: jest.fn(),
  })),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock EventSource
class MockEventSource {
  onmessage: ((event: any) => void) | null = null;
  onopen: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  close = jest.fn();

  constructor() {
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }
}

(global as any).EventSource = MockEventSource;

describe('VIPList', () => {
  const mockVips = [
    {
      id: '1',
      channelId: 'test-channel',
      userId: 'test-user',
      username: 'test-user',
      grantedAt: new Date(),
      expiresAt: new Date(),
      isActive: true,
      grantedBy: 'system',
      grantMethod: 'manual',
    },
    {
      id: '2',
      channelId: 'test-channel',
      userId: 'test-user-2',
      username: 'test-user-2',
      grantedAt: new Date(),
      expiresAt: new Date(),
      isActive: true,
      grantedBy: 'system',
      grantMethod: 'manual',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockVips),
      })
    );
  });

  it('renders loading state initially', () => {
    render(<VIPList initialChannelId="test-channel" />);
    expect(screen.getByText('Loading VIP list...')).toBeInTheDocument();
  });

  it('renders error message when no channelId is provided', () => {
    render(<VIPList initialChannelId="" />);
    expect(
      screen.getByText('Unable to load VIP list. Please try again later.')
    ).toBeInTheDocument();
  });

  it('renders VIP list after loading', async () => {
    render(<VIPList initialChannelId="test-channel" />);

    await waitFor(() => {
      expect(screen.getByText('test-user')).toBeInTheDocument();
      expect(screen.getByText('test-user-2')).toBeInTheDocument();
    });

    expect(screen.getByText('Via: Channel Points')).toBeInTheDocument();
    expect(screen.getByText('Via: Manual')).toBeInTheDocument();
  });

  it('handles VIP removal', async () => {
    (global.fetch as jest.Mock)
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVips),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
      );

    render(<VIPList initialChannelId="test-channel" />);

    await waitFor(() => {
      expect(screen.getAllByText('Remove VIP')).toHaveLength(2);
    });

    const removeButtons = screen.getAllByText('Remove VIP');
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Removed VIP status from test-user'
      );
    });
  });

  it('handles VIP removal error', async () => {
    (global.fetch as jest.Mock)
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVips),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
        })
      );

    render(<VIPList initialChannelId="test-channel" />);

    await waitFor(() => {
      expect(screen.getAllByText('Remove VIP')).toHaveLength(2);
    });

    const removeButtons = screen.getAllByText('Remove VIP');
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to remove VIP status');
    });
  });

  it('handles WebSocket updates', async () => {
    const updatedVips = [mockVips[0]];
    render(<VIPList initialChannelId="test-channel" />);

    await waitFor(() => {
      expect(screen.getAllByText('Remove VIP')).toHaveLength(2);
    });

    // Simulate WebSocket message
    const ws = (global as any).EventSource.mock.instances[0];
    if (ws.onmessage) {
      ws.onmessage({
        data: JSON.stringify({
          type: 'vip_update',
          vips: updatedVips,
        }),
      });
    }

    await waitFor(() => {
      expect(screen.getAllByText('Remove VIP')).toHaveLength(1);
      expect(screen.queryByText('test-user-2')).not.toBeInTheDocument();
    });
  });
}); 