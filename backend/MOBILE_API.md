# Mobile Companion API

This document describes how the mobile app should authenticate and call the read-only agenda endpoint.

---

## Authentication

All API calls require a valid JWT access token obtained from the login flow.

### 1. Obtain tokens

```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secret"
}
```

Response:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<uuid>"
}
```

- **accessToken** expires in **15 minutes**. Attach it to every request as a `Bearer` token.
- **refreshToken** expires in **7 days**. Use it to silently obtain a new access token.

### 2. Refresh the access token

```
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "<uuid>"
}
```

Response:

```json
{
  "accessToken": "<new-jwt>",
  "refreshToken": "<new-uuid>"
}
```

> Tokens are rotated on every refresh. Persist the new `refreshToken` and discard the old one.

---

## Agenda Endpoint

### `GET /api/agenda`

Returns the authenticated user's scheduled blocks for a given time window, joined with task metadata. This is the primary endpoint for the mobile agenda view.

**Authentication:** Required (`Authorization: Bearer <accessToken>`)

**Query parameters:**

| Parameter | Type   | Required | Description                              |
|-----------|--------|----------|------------------------------------------|
| `from`    | string | No       | ISO 8601 datetime — window start (inclusive) |
| `to`      | string | No       | ISO 8601 datetime — window end (inclusive)   |

If neither `from` nor `to` is provided, all blocks for the user are returned.

**Example request:**

```
GET /api/agenda?from=2026-03-12T00:00:00Z&to=2026-03-12T23:59:59Z
Authorization: Bearer <accessToken>
```

**Example response:**

```json
[
  {
    "id": "b3f2a1c0-...",
    "title": "Deep work: API design",
    "startTime": "2026-03-12T09:00:00.000Z",
    "endTime": "2026-03-12T11:00:00.000Z",
    "type": "flexible",
    "taskId": "a1b2c3d4-...",
    "color": "purple"
  },
  {
    "id": "d4e5f6a7-...",
    "title": "Team standup",
    "startTime": "2026-03-12T11:00:00.000Z",
    "endTime": "2026-03-12T11:30:00.000Z",
    "type": "anchor",
    "taskId": "e7f8a9b0-...",
    "color": "blue"
  }
]
```

**Response fields:**

| Field       | Type     | Description                                         |
|-------------|----------|-----------------------------------------------------|
| `id`        | string   | UUID of the scheduled block                         |
| `title`     | string   | Task title                                          |
| `startTime` | string   | ISO 8601 UTC datetime                               |
| `endTime`   | string   | ISO 8601 UTC datetime                               |
| `type`      | string   | `"flexible"` \| `"anchor"` \| `"fixed"`             |
| `taskId`    | string   | UUID of the parent task                             |
| `color`     | string   | Color ID: `"purple"` (deep) \| `"blue"` (moderate) \| `"green"` (light) \| `"teal"` (default) |

**Color mapping** (derived from task's energy intensity):

| `color`    | Energy intensity | Suggested hex |
|------------|-----------------|---------------|
| `purple`   | deep            | `#8b77d4`     |
| `blue`     | moderate        | `#4da6f5`     |
| `green`    | light           | `#4db87a`     |
| `teal`     | fallback        | `#2ec4b6`     |

**Error responses:**

| Status | Body                                              | Cause                            |
|--------|---------------------------------------------------|----------------------------------|
| 401    | `{"error": "Missing or invalid authorization header"}` | No / malformed token        |
| 401    | `{"error": "Invalid or expired token"}`           | Expired access token — refresh it |
| 500    | `{"error": "Internal server error"}`              | Unexpected server error          |

---

## Recommended mobile flow

```
App launch
  └─ Load stored accessToken + refreshToken
        │
        ├─ accessToken valid? ──Yes──► GET /api/agenda
        │
        └─ No / expired?
              └─ POST /auth/refresh
                    ├─ Success ──► persist new tokens ──► GET /api/agenda
                    └─ Failure (refresh expired) ──► show login screen
```

### Suggested polling / refresh strategy

- Fetch agenda on app foreground and after any auth refresh.
- For a "today" view: `from=<start-of-day>&to=<end-of-day>` (UTC).
- For a week view: `from=<monday-00:00Z>&to=<sunday-23:59Z>`.

### CORS note

The backend's CORS policy currently allows only the configured `FRONTEND_URL` origin. For the mobile app (which does not send an `Origin` header from native code), requests will pass through without issue. If using a WebView, ensure the `FRONTEND_URL` environment variable on the server includes the WebView origin, or set it to `*` during development.
