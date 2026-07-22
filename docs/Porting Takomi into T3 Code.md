# Porting Takomi into T3 Code

**Status:** Pi provider implemented and locally validated; Takomi Code product migration deferred  
**Last updated:** 2026-07-22  
**Repositories involved:**

- Takomi protocol and extensions: `2025-12-02_VibeCode-Protocol-Suite`
- T3 Code integration fork: `2026-07-22_t3code`, branch `Takomi-Code`
- Legacy Takomi Code: `2026-03-10_Takomi_Code`
- Legacy Takomi Code TypeScript experiment: `2026-03-20_Takomi_Code_Ts`
- Legacy mobile experiment: `2026-06-13_Takomi_Mobile`

---

## 1. Purpose

This document records the integration of Takomi, which is built on Pi, into T3 Code and outlines a possible future transition from a T3 Code fork into a fully branded **Takomi Code** product.

The immediate goal was to gain T3 Code's desktop and web interface, remote access, project management, diff rendering, attachments, terminals, and provider orchestration while preserving Takomi's Pi-based workflows, extensions, skills, subagents, and model routing.

The longer-term product question is whether the working T3 Code fork should become the canonical successor to the older Takomi Code and Takomi Mobile repositories.

---

## 2. Current decision

The current architecture uses a **native Pi provider driver inside T3 Code**.

```text
T3 Code web/desktop UI
        |
        | T3 canonical provider events
        v
PiAdapter / PiDriver
        |
        | Pi JSON-RPC over stdin/stdout
        v
Pi CLI
        |
        +-- Takomi runtime
        +-- Takomi subagents
        +-- context manager
        +-- OAuth router
        +-- skills and prompts
```

This was preferred over rewriting Takomi or embedding Takomi logic directly into T3 Code's UI because it keeps the two systems modular:

- T3 Code owns the GUI, desktop host, web server, projects, attachments, and provider-neutral orchestration.
- Pi owns agent sessions, models, tools, context, and JSON-RPC.
- Takomi remains a set of Pi extensions, skills, policies, workflows, and routing behavior.

---

## 3. What is implemented

The T3 Code fork includes:

- a first-party `pi` provider driver
- a Pi provider health probe
- a real Pi JSON-RPC adapter
- process lifecycle and cleanup
- text and reasoning streaming
- tool lifecycle events
- image attachments
- extension UI requests and responses
- session persistence through Pi session files
- model switching through acknowledged RPC requests
- context compaction events
- interruption handling
- Takomi provider registration in the web UI
- an optional Takomi suite source path for development
- global-first Pi and Takomi discovery for normal installations

Primary implementation files in the T3 fork:

```text
apps/server/src/provider/Drivers/PiDriver.ts
apps/server/src/provider/Layers/PiAdapter.ts
apps/server/src/provider/Layers/PiProvider.ts
apps/server/src/provider/builtInDrivers.ts
apps/web/src/components/chat/providerIconUtils.ts
apps/web/src/components/settings/providerDriverMeta.ts
apps/web/src/session-logic.ts
packages/contracts/src/providerRuntime.ts
packages/contracts/src/settings.ts
```

### Validated behavior

The integration has been tested with the real Pi executable and Takomi installation:

- Pi starts in RPC mode.
- Takomi commands and extensions load.
- Assistant output streams into T3 Code.
- Tool calls appear in the T3 work log.
- Images reach the Pi model and are persisted in the Pi session.
- Pi session files are persisted as T3 resume cursors.
- Normal turns settle correctly.
- Interrupted turns settle as interrupted and the process is stopped.
- T3-created Pi sessions can be opened later from the Pi CLI.
- Contracts, server, and web typechecks pass.
- Contracts and server settings tests pass.
- The web production build succeeds.

---

## 4. Installation and resource discovery

### Normal installation: global-first

A normal user should not need the VibeCode Protocol Suite source checkout.

Expected provider configuration:

```text
Binary path: pi
Pi agent directory: blank
Takomi suite root: blank
Launch arguments: blank
```

With these values, Pi uses its normal global resource discovery:

```text
~/.pi/agent/settings.json
~/.pi/agent/extensions/
~/.pi/agent/prompts/
~/.pi/agent/themes/
~/.agents/skills/
```

The user still needs:

1. Pi installed and available on `PATH`.
2. Pi authentication configured.
3. Takomi installed globally into Pi's resource locations.

Pi alone provides plain Pi. Takomi's extensions and skills must also be installed, but the complete Takomi source repository is not required.

### Development installation: suite source override

The optional **Takomi suite root** setting is for Takomi development.

Example:

```text
C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite
```

When configured, the adapter loads the suite's Takomi extensions and prompt templates directly. This is useful when testing uninstalled source changes and avoids stale global copies.

### Future packaged installation

A polished Takomi Code installer could bundle versioned Takomi runtime assets inside the desktop application's resources. That would allow a user to install:

1. Pi
2. Takomi Code

without separately cloning or globally copying Takomi assets.

This is not required for the current local build and remains future packaging work.

---

## 5. Running and building

The development runner assigns ports dynamically. Use the URL printed by Vite rather than assuming port `3773`.

Example observed development ports:

```text
Web:    http://localhost:5733
Server: http://127.0.0.1:13773
```

### Browser development

```powershell
cd C:\CreativeOS\01_Projects\Code\Clones\2026-07-22_t3code
pnpm dev
```

### Desktop development

```powershell
pnpm dev:desktop
```

### Windows installer

```powershell
pnpm dist:desktop:win:x64
```

The browser workflow should be validated before producing an installer.

---

## 6. Session behavior

### T3 Code to Pi

T3-created Pi sessions are persisted in Pi's normal session directory. The adapter stores the Pi session file as a T3 resume cursor.

A T3 session can later be opened manually with:

```powershell
pi -r
```

or:

```powershell
pi --session "C:\path\to\session.jsonl"
```

Do not open the exact same session file in terminal Pi while T3 is actively using it. Two processes writing one JSONL session could conflict.

### Pi to T3 Code

Automatic import of independently created terminal Pi sessions into the T3 sidebar is **not implemented**. This would require a Pi session discovery and import layer.

Therefore, current synchronization is:

- T3-created session -> visible and resumable in Pi: supported
- terminal-created Pi session -> automatically appears in T3: deferred

### Restart safety

T3 now waits for Pi's `get_state` response and persistent session file before completing session startup. This prevents a server restart from creating a second Pi session because the resume cursor was not yet known.

---

## 7. Current limitations

1. **Full-access runtime only**  
   Pi/Takomi sessions currently reject T3's safer runtime modes. Proper approval enforcement must exist before `approval-required` or `auto-accept-edits` can be advertised.

2. **No terminal-to-T3 session discovery**  
   Existing Pi sessions are not scanned into the T3 sidebar.

3. **Takomi is not bundled into the desktop installer**  
   The current build expects global Takomi resources or an explicit suite root.

4. **Pi utility text generation is not implemented**  
   T3 features that request provider-specific utility generation, such as titles or commit text, should not rely on the Pi driver yet.

5. **Windows shell deprecation warning**  
   Launching the npm-installed `pi.cmd` can produce Node's `DEP0190` shell warning. It is noisy but is not the cause of T3 connection restarts.

6. **Development server reconnects**  
   `node --watch` restarts the T3 server when server source files change. The browser then reconnects and may require the latest pairing URL. This is expected during development.

---

## 8. Should this become Takomi Code?

Yes, the working T3 fork is a credible foundation for **Takomi Code V2**.

It is substantially more practical than continuing to build a separate GUI platform from scratch because T3 Code already provides mature infrastructure for:

- desktop packaging
- responsive web access
- provider-neutral sessions
- projects and worktrees
- terminals and diffs
- attachments
- remote connectivity
- upstream product improvements

The key is to treat Takomi Code as a maintained downstream product, not as a one-time copy of T3 Code.

---

## 9. Recommended repository strategy

### Recommendation

Use the T3 Code fork as the new implementation base, while preserving the old Takomi Code repository history on permanent legacy branches and tags.

Do **not**:

- copy one repository's `.git` directory into another
- merge unrelated histories into a single mainline
- delete the old repository before making verifiable backups
- perform a global T3-to-Takomi search-and-replace

Those approaches create confusing history, unnecessary merge conflicts, and difficult upstream synchronization.

### Preferred branch model

```text
main
  Canonical Takomi Code releases

legacy/v1
  Original Takomi_Code history

legacy/typescript-remaster
  Takomi_Code_Remastered history or final snapshot

upstream/main
  Official T3 Code history

sync/t3-YYYY-MM-DD
  Temporary branch for each upstream integration
```

### Two safe repository choices

#### Choice A: Create a new canonical Takomi Code fork

This is operationally the cleanest option.

1. Fork T3 Code into a new `Takomi-Code` repository.
2. Push the current `Takomi-Code` branch.
3. Preserve the old `Takomi_Code` repository as archived or private.
4. Add a deprecation notice pointing to Takomi Code V2.
5. Optionally import the old history as `legacy/v1` without merging it into `main`.

Advantages:

- clean T3 ancestry
- clear upstream comparison
- simpler pulls and merges
- minimal risk to the old repository

#### Choice B: Reuse the existing `JStaRFilms/Takomi_Code` repository

This preserves the established repository name and URL.

Before replacing its default branch:

1. Back up every remote branch and tag.
2. Create and push `legacy/v1` from the old build.
3. Add an annotated legacy tag.
4. Push the T3-based history as a new candidate branch.
5. Validate the candidate branch in GitHub and locally.
6. Change the default branch only after verification.
7. Never delete `legacy/v1`.

This keeps both histories in one repository as separate branches. They should not be merged with `--allow-unrelated-histories` merely to make them appear connected.

### Current preference

**Choice A is technically cleaner. Choice B is reasonable if retaining the existing Takomi Code URL and identity is important.**

The decision can be deferred. No repository migration is required to continue development and desktop testing in the present T3 fork.

---

## 10. Upstream synchronization strategy

The current clone still points `origin` at official T3 Code. Before publishing Takomi Code, use separate remotes:

```bash
origin    -> JStaRFilms/Takomi-Code or JStaRFilms/Takomi_Code
upstream  -> pingdotgg/t3code
```

Recommended sync process:

```bash
git fetch upstream
git switch main
git switch -c sync/t3-YYYY-MM-DD
git merge upstream/main

pnpm install
pnpm typecheck
pnpm test
pnpm --filter @t3tools/web build
```

Resolve conflicts and validate the desktop application on the sync branch. Merge it into Takomi Code's `main` only after testing.

Do not sync directly into release `main` without an integration branch.

### Keep custom changes additive

Upstream maintenance remains manageable when Takomi-specific code is isolated in:

- Pi driver and adapter modules
- provider registration points
- branding configuration
- Takomi-owned assets
- narrowly scoped defaults

Avoid scattering Takomi conditionals throughout T3's core orchestration and UI.

---

## 11. Rebranding strategy

Rebranding is larger than renaming visible strings and should be handled as a separate project phase.

### Phase 1: Product identity layer

Create a central branding configuration for:

- application name
- logos and icons
- colors
- desktop bundle identifier
- installer name
- URLs
- update channels
- telemetry and error-reporting labels
- About screen and attribution

Initially preserve internal package names such as `@t3tools/*` where changing them would create ongoing upstream conflicts. User-facing branding can change without immediately renaming every internal module.

### Phase 2: Takomi-first defaults

- make Takomi the primary provider in onboarding
- select Takomi as the default provider when installed
- retain Codex, Claude, Cursor, Grok, and OpenCode as additional providers
- provide Takomi installation and health guidance
- expose global installation versus bundled runtime clearly

### Phase 3: Distribution

- bundle or install Takomi runtime assets
- establish Windows signing and release artifacts
- define automatic update behavior
- preserve the upstream MIT license and T3 Tools copyright notice
- add Takomi copyright and attribution without removing required notices

T3 Code is MIT licensed, which permits modification and redistribution, but its copyright and license notice must remain in copies or substantial portions of the software.

### Phase 4: Mobile and remote product behavior

Clarify whether "mobile" means:

- responsive browser access to a running desktop/server host
- a PWA wrapper
- a native mobile client
- a hosted relay service

The present integration supports the first model. It is not yet a standalone on-device coding runtime.

---

## 12. Legacy project handling

Relevant legacy repositories currently include:

```text
JStaRFilms/Takomi_Code
JStaRFilms/Takomi_Code_Remastered
JStaRFilms/Takomi_Mobile
```

Recommended treatment after Takomi Code V2 has a stable release:

1. Add a concise deprecation notice.
2. Link to the canonical Takomi Code repository.
3. Tag the final legacy release.
4. Archive the repositories on GitHub or make them private.
5. Move local copies into an archive directory only after remote verification.
6. Do not permanently delete local repositories until backups and remote branches are confirmed.

Suggested notice:

```markdown
# Deprecated: superseded by Takomi Code V2

This repository contains an earlier Takomi Code experiment. Its useful product
ideas have been consolidated into Takomi Code V2, built on T3 Code with a native
Pi/Takomi provider.

This repository remains available for historical reference and is no longer
actively developed.
```

---

## 13. Deferred roadmap

### Near term

- continue browser and desktop testing
- validate session resume across server restarts
- validate global Takomi discovery with no suite root
- verify desktop installer behavior
- document common provider health and pairing warnings

### Before a public Takomi Code release

- choose the canonical GitHub repository
- establish `origin` and `upstream` remotes
- preserve legacy branches and tags
- add centralized branding
- decide whether Takomi is globally installed or bundled
- add Pi adapter protocol tests
- implement provider utility text generation or define fallbacks
- review security expectations for full-access sessions

### Later

- terminal Pi session discovery and optional import
- T3 approval-mode enforcement for Pi tools
- packaged Takomi assets
- release signing and update channels
- remote/mobile deployment documentation
- optional native mobile client evaluation

---

## 14. Final recommendation

Continue developing and testing the current T3 fork without moving repositories yet.

Once the desktop build is stable:

1. freeze and tag the old Takomi Code implementation
2. preserve it as `legacy/v1`
3. choose whether to create a new Takomi Code fork or reuse the existing repository URL
4. publish the T3-based implementation on a candidate branch
5. complete the branding work in isolated phases
6. switch the default branch only after the candidate build is verified
7. archive Takomi Mobile after the responsive/mobile workflow is proven

The important principle is:

> Preserve the old experiments as history, but do not force their unrelated Git history into the new product's mainline.

The migration and full rebrand are intentionally deferred. The present Pi/Takomi provider can continue evolving independently while this product decision is discussed.
