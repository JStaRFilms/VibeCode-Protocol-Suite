# oauth-router

Pi extension that auto-loads and registers an `oauth-router` provider with multi-account routing, health tracking, cooldowns, and extension-owned credential storage.

## What it does

- auto-loads from `~/.pi/agent/extensions/oauth-router`
- registers provider: `oauth-router`
- stores multiple accounts in `~/.pi/agent/oauth-router/credentials.json`
- stores health, cooldown, and routing state in `~/.pi/agent/oauth-router/state.json`
- supports account commands:
  - `/router-login add`
  - `/router-login list`
  - `/router-login remove [id]` / `/router-delete [id]`
  - `/router-login rename [id] [label]` / `/router-rename [id] [label]`
  - `/router-login relogin [id]` / `/router-relogin [id]`
  - `/router-login refresh [id]`
  - `/router-status`
  - `/router-usage [id]` / `/router-quota [id]`
  - `/router-usage-raw [id]`
  - `/router-refresh-usage [id|all]`
  - `/router-enable [id]`
  - `/router-disable [id]`
  - `/router-policy <name>`
- routes across healthy accounts with:
  - round robin
  - weighted round robin
  - 429 cooldowns
  - transient failure penalties
  - client/network transport failure tracking without default account cooldown
  - live Pi UI footer/notification updates when an upstream attempt, retry delay, failover, or final router error happens
  - 5 router-level client/network retries by default before pre-output failover, starting at 5s and doubling
  - auth failure quarantine
  - safe pre-output failover

## Default upstreams

The extension ships with two default upstream profiles:

1. `chatgpt-codex`
   - auth mode: OAuth
   - oauth provider: `openai-codex`
   - api: `openai-codex-responses`
   - default models: `gpt-5.4-mini`, `gpt-5.4`, `gpt-5.5`, `gpt-5.6-luna`, `gpt-5.6-sol`, `gpt-5.6-terra`

2. `openai-compatible`
   - auth mode: API key fallback
   - api: `openai-responses`
   - default models: `gpt-5.4-mini`, `gpt-5.4`, `gpt-5.5`, `gpt-5.6-luna`, `gpt-5.6-sol`, `gpt-5.6-terra`

Edit `~/.pi/agent/oauth-router/config.json` to add more upstreams, swap endpoints, change model catalogs, or tune retry behavior. By default client-side transport failures such as `Codex SSE response headers timed out after 10000ms` retry the same account 5 times with exponential backoff (`5s`, `10s`, `20s`, `40s`, then capped at `60s`) before router failover. While this is happening, Pi's footer shows the active retry/failover/error state so the UI no longer looks frozen. These failures are recorded but do not cool down an account unless `clientNetworkPenaltyMs` is set above `0`.

## Setup

1. Restart Pi or run `/reload`
2. Confirm the provider is present:
   - `pi --list-models | grep oauth-router`
3. Add an account:
   - OAuth: `/router-login add chatgpt-codex`
   - API key fallback: `/router-login add openai-compatible`
4. Check state and local usage windows:
   - `/router-status`
   - `/router-usage`
5. Select a model:
   - `oauth-router/gpt-5.6-sol`

## Account storage format

Credentials live in:

- `~/.pi/agent/oauth-router/credentials.json`

Shape:

```json
{
  "version": 1,
  "accounts": [
    {
      "id": "acct_ab12cd34",
      "label": "Primary Codex",
      "provider": "openai-codex",
      "upstreamId": "chatgpt-codex",
      "access": "<sensitive>",
      "refresh": "<sensitive>",
      "expires": 1777580854310,
      "enabled": true,
      "weight": 1,
      "createdAt": 1776000000000,
      "updatedAt": 1776000000000,
      "meta": {
        "accountId": "..."
      }
    }
  ]
}
```

Health and local usage state live separately in:

- `~/.pi/agent/oauth-router/state.json`

The router records successful request usage per account for rolling local 5-hour and weekly windows. These are router-observed counters only. `/router-refresh-usage [id|all]` probes ChatGPT/Codex provider quota from `/backend-api/wham/usage` first and treats `rate_limit.primary_window.used_percent` as the 5-hour window and `rate_limit.secondary_window.used_percent` as the weekly window. It then falls back to safe token claims such as account id, token expiry, issuer, subject, and available claim keys. `/router-usage` shows a compact visual quota view; `/router-usage-raw [id]` shows detailed/raw provider data. Provider-side quota counters depend on undocumented upstream endpoints and may change; they are not normally present in the OAuth token itself.

Most account commands accept an optional account ID. When run in the Pi UI without an ID, the extension opens an account picker instead of dumping the same account list repeatedly.

## Security notes

- credentials are stored separately from health state
- files are written with restrictive permissions where the OS allows it
- command output redacts secrets
- token inspection reports metadata/claim keys only, not raw access or refresh tokens
- the extension does not log access or refresh tokens

## Known limitations

- Pi's built-in `/login` is intentionally not used for multi-account storage because Pi stores one OAuth identity per provider entry
- the shipped OAuth adapter reuses Pi's built-in `openai-codex` OAuth implementation; generic OpenAI-compatible upstream OAuth still requires provider-specific adapters
- safe failover only happens before meaningful output is emitted; no unsafe mid-stream account switching is attempted
- API key fallback is supported, but OAuth remains the primary path for subscription-style upstreams
- duplicate OAuth identities are detected after login and converted into an existing-account credential update unless explicitly allowed, because the same underlying refresh token lineage can invalidate another router/client session
- local 5-hour/weekly usage windows are not provider quota truth; they only count requests that went through this router

## Validation

Run:

```bash
python scripts/vibe-verify.py
```

## Docs

OAuth Router documentation is maintained in the repo-level docs tree so it stays unified with the rest of Takomi/Pi documentation:

- `../../../docs/features/Pi_OAuth_Router.md`
- `../../../docs/oauth-router/genesis/Project_Requirements.md`
- `../../../docs/oauth-router/genesis/Coding_Guidelines.md`
- `../../../docs/oauth-router/genesis/Builder_Prompt.md`
- `../../../docs/oauth-router/genesis/issues/`
