import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import VIPList from '../vip-list';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('VIPList', () => {
  const mockVips = [
    {
      id: '1',
      channelId: 'test-channel',
      userId: 'user1',
      username: 'TestUser1',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      isActive: true,
      redeemedWith: 'channel_points',
    },
    {
      id: '2',
      channelId: 'test-channel',
      userId: 'user2',
      username: 'TestUser2',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 7200000),
      isActive: true,
      redeemedWith: 'manual',
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
    render(<VIPList channelId="test-channel" />);
    expect(screen.getByText('Loading VIP list...')).toBeInTheDocument();
  });

  it('renders error message when no channelId is provided', () => {
    render(<VIPList />);
    expect(
      screen.getByText('Unable to load VIP list. Please try again later.')
    ).toBeInTheDocument();
  });

  it('renders VIP list after loading', async () => {
    render(<VIPList channelId="test-channel" />);

    await waitFor(() => {
      expect(screen.getByText('TestUser1')).toBeInTheDocument();
      expect(screen.getByText('TestUser2')).toBeInTheDocument();
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

    render(<VIPList channelId="test-channel" />);

    await waitFor(() => {
      expect(screen.getAllByText('Remove VIP')).toHaveLength(2);
    });

    const removeButtons = screen.getAllByText('Remove VIP');
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Removed VIP status from TestUser1'
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

    render(<VIPList channelId="test-channel" />);

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
    render(<VIPList channelId="test-channel" />);

    await waitFor(() => {
      expect(screen.getAllByText('Remove VIP')).toHaveLength(2);
    });

    // Simulate WebSocket message
    const ws = (global as any).WebSocket.mock.instances[0];
    ws.onmessage({
      data: JSON.stringify({
        type: 'vip_update',
        vips: updatedVips,
      }),
    });

    await waitFor(() => {
      expect(screen.getAllByText('Remove VIP')).toHaveLength(1);
      expect(screen.queryByText('TestUser2')).not.toBeInTheDocument();
    });
  });
}); 