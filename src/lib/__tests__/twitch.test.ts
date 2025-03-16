import { ApiClient, HelixChannelApi, HelixChannelPointsApi, HelixUserRelation, HelixPaginatedResult, HelixCustomReward } from '@twurple/api';
import { grantVIPStatus, removeVIPStatus, isUserVIP, createChannelPointReward } from '../twitch';

// Mock @twurple/api
jest.mock('@twurple/api', () => ({
  ApiClient: jest.fn(),
}));

describe('Twitch VIP Management', () => {
  const mockChannelId = 'test-channel';
  const mockUserId = 'test-user';
  const mockRewardId = 'test-reward';

  let mockApiClient: {
    channels: {
      addVip: jest.Mock;
      removeVip: jest.Mock;
      getVips: jest.Mock;
    };
    channelPoints: {
      createCustomReward: jest.Mock;
    };
  };

  beforeEach(() => {
    mockApiClient = {
      channels: {
        addVip: jest.fn(),
        removeVip: jest.fn(),
        getVips: jest.fn(),
      },
      channelPoints: {
        createCustomReward: jest.fn(),
      },
    };

    (ApiClient as jest.Mock).mockImplementation(() => mockApiClient);
  });

  describe('grantVIPStatus', () => {
    it('grants VIP status successfully', async () => {
      mockApiClient.channels.addVip.mockResolvedValue(undefined);

      const result = await grantVIPStatus({
        channelId: mockChannelId,
        userId: mockUserId,
        username: 'test-user',
        grantedBy: 'system',
      });

      expect(result.success).toBe(true);
      expect(mockApiClient.channels.addVip).toHaveBeenCalledWith(
        mockChannelId,
        mockUserId
      );
    });

    it('handles errors when granting VIP status', async () => {
      mockApiClient.channels.addVip.mockRejectedValue(new Error('API Error'));

      const result = await grantVIPStatus({
        channelId: mockChannelId,
        userId: mockUserId,
        username: 'test-user',
        grantedBy: 'system',
      });

      expect(result.success).toBe(false);
      expect(mockApiClient.channels.addVip).toHaveBeenCalledWith(
        mockChannelId,
        mockUserId
      );
    });
  });

  describe('removeVIPStatus', () => {
    it('removes VIP status successfully', async () => {
      mockApiClient.channels.removeVip.mockResolvedValue(undefined);

      const result = await removeVIPStatus(mockChannelId, mockUserId);

      expect(result).toBe(true);
      expect(mockApiClient.channels.removeVip).toHaveBeenCalledWith(
        mockChannelId,
        mockUserId
      );
    });

    it('handles errors when removing VIP status', async () => {
      mockApiClient.channels.removeVip.mockRejectedValue(new Error('API Error'));

      const result = await removeVIPStatus(mockChannelId, mockUserId);

      expect(result).toBe(false);
      expect(mockApiClient.channels.removeVip).toHaveBeenCalledWith(
        mockChannelId,
        mockUserId
      );
    });
  });

  describe('isUserVIP', () => {
    it('returns true when user is a VIP', async () => {
      const mockResult: Partial<HelixPaginatedResult<HelixUserRelation>> = {
        data: [{ id: mockUserId } as HelixUserRelation],
      };
      
      mockApiClient.channels.getVips.mockResolvedValue(mockResult);

      const result = await isUserVIP(mockChannelId, mockUserId);

      expect(result).toBe(true);
      expect(mockApiClient.channels.getVips).toHaveBeenCalledWith(mockChannelId);
    });

    it('returns false when user is not a VIP', async () => {
      const mockResult: Partial<HelixPaginatedResult<HelixUserRelation>> = {
        data: [{ id: 'other-user' } as HelixUserRelation],
      };
      
      mockApiClient.channels.getVips.mockResolvedValue(mockResult);

      const result = await isUserVIP(mockChannelId, mockUserId);

      expect(result).toBe(false);
      expect(mockApiClient.channels.getVips).toHaveBeenCalledWith(mockChannelId);
    });

    it('handles errors when checking VIP status', async () => {
      mockApiClient.channels.getVips.mockRejectedValue(new Error('API Error'));

      const result = await isUserVIP(mockChannelId, mockUserId);

      expect(result).toBe(false);
      expect(mockApiClient.channels.getVips).toHaveBeenCalledWith(mockChannelId);
    });
  });

  describe('createChannelPointReward', () => {
    const mockTitle = 'Test Reward';
    const mockCost = 5000;

    it('creates channel point reward successfully', async () => {
      const mockReward: Partial<HelixCustomReward> = {
        id: mockRewardId,
      };
      
      mockApiClient.channelPoints.createCustomReward.mockResolvedValue(mockReward);

      const result = await createChannelPointReward(
        mockChannelId,
        mockTitle,
        mockCost
      );

      expect(result).toBe(mockRewardId);
      expect(mockApiClient.channelPoints.createCustomReward).toHaveBeenCalledWith(
        mockChannelId,
        expect.objectContaining({
          title: mockTitle,
          cost: mockCost,
          isEnabled: true,
          autoFulfill: false,
        })
      );
    });

    it('handles errors when creating channel point reward', async () => {
      mockApiClient.channelPoints.createCustomReward.mockRejectedValue(
        new Error('API Error')
      );

      const result = await createChannelPointReward(
        mockChannelId,
        mockTitle,
        mockCost
      );

      expect(result).toBeNull();
      expect(mockApiClient.channelPoints.createCustomReward).toHaveBeenCalled();
    });
  });
}); 