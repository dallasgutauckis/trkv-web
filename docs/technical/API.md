# API Documentation

## Authentication

All API endpoints require authentication using NextAuth.js with Twitch OAuth. The following scopes are required:
- `channel:manage:vips`
- `channel:read:redemptions`
- `moderator:read:chatters`
- `channel:read:vips`

### Headers
```
Authorization: Bearer <access_token>
```

## Endpoints

### VIP Management

#### GET /api/vip
Retrieves active VIP sessions for a channel.

Query Parameters:
- `channelId` (required): The Twitch channel ID

Response:
```json
{
  "vips": [
    {
      "sessionId": "string",
      "userId": "string",
      "username": "string",
      "grantedAt": "string",
      "expiresAt": "string",
      "redeemedWith": "channel_points"
    }
  ]
}
```

#### POST /api/vip
Grants VIP status to a user.

Request Body:
```json
{
  "userId": "string",
  "username": "string",
  "channelId": "string",
  "redeemedWith": "channel_points"
}
```

Response:
```json
{
  "sessionId": "string",
  "userId": "string",
  "username": "string",
  "grantedAt": "string",
  "expiresAt": "string"
}
```

#### DELETE /api/vip
Removes VIP status from a user.

Query Parameters:
- `sessionId` (required): The VIP session ID
- `channelId` (required): The Twitch channel ID
- `userId` (required): The user's Twitch ID

Response:
```json
{
  "success": true
}
```

### Channel Configuration

#### GET /api/config
Retrieves channel configuration.

Query Parameters:
- `channelId` (required): The Twitch channel ID

Response:
```json
{
  "channelId": "string",
  "channelPointRewardId": "string",
  "vipDuration": "number",
  "enabled": "boolean"
}
```

#### POST /api/config
Updates channel configuration.

Request Body:
```json
{
  "channelId": "string",
  "channelPointRewardId": "string",
  "vipDuration": "number",
  "enabled": "boolean"
}
```

Response:
```json
{
  "success": true
}
```

### WebSocket

#### GET /api/ws
Establishes a WebSocket connection for real-time updates.

Query Parameters:
- `channelId` (required): The Twitch channel ID

Events:
```typescript
interface VIPGranted {
  type: 'vip_granted';
  data: {
    sessionId: string;
    userId: string;
    username: string;
    grantedAt: string;
    expiresAt: string;
  };
}

interface VIPRemoved {
  type: 'vip_removed';
  data: {
    sessionId: string;
    userId: string;
  };
}
```

### Cron Jobs

#### POST /api/cron/remove-expired-vips
Removes expired VIP sessions. Requires `CRON_SECRET` header.

Headers:
```
Authorization: Bearer <CRON_SECRET>
```

Response:
```json
{
  "removed": "number"
}
```

## Rate Limiting

- API endpoints are rate-limited to 100 requests per minute per IP
- WebSocket connections are limited to 10 concurrent connections per channel

## Error Responses

All errors follow this format:
```json
{
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

Common error codes:
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error 