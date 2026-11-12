---
tags: [reference, cli, auth, distribution]
---

# Command-line client

[Home](../index.md)

`fcsia` is the IA App command-line client. It reads the same announcements,
events, Flex days, clubs, notifications, and staff queues as the web app, using
the same account and the same permissions. It adds no server-side capability.

The CLI is a niche surface: school-managed Chromebooks cannot run it, and the
web and mobile apps remain the main way students use IA App.

## Install

On macOS and Linux, run:

```sh
curl -fsSL https://app.fcsia.com/install.sh | sh
```

The script downloads the release for the current machine, checks it against
the release's `SHA256SUMS`, and installs it to `~/.local/bin/fcsia`. Set
`FCSIA_INSTALL_DIR` to install somewhere else, or `FCSIA_VERSION=v0.5.0` to pin
a release.

The same binaries are attached to every GitHub release for manual download:

```sh
shasum -a 256 fcsia-darwin-arm64
```

Windows binaries are attached to the release as `fcsia-windows-x64.exe`.

The npm packages are assembled by the release workflow but are not published
yet, and there is no Nix package. The install script and release downloads are
the supported paths today.

### Upgrade

`fcsia upgrade --check` asks GitHub for the latest release and prints the
current and latest versions. `fcsia upgrade` downloads the matching binary,
verifies its checksum, and replaces the running copy in place.

Upgrading only works for a compiled copy, such as one installed by the script
or downloaded from a release. A copy run from source with `bun` cannot replace
itself. If the binary is installed with npm, update it with npm instead.

## Sign in

```sh
fcsia login
```

`login` uses the OAuth device flow. It prints a verification page and a short
code, opens the page in your browser, and waits for you to approve the code.
`fcsia login --no-browser` prints the page and code without opening anything.

The session token is kept in the operating system's credential store
(Keychain, Secret Service, or Credential Manager) under the site it belongs to.
When no store is available, it goes in a file readable only by your account.
`FCSIA_CREDENTIAL_STORE=file` forces the file store, which is useful in
containers and CI.

Sign in to a local development site with:

```sh
fcsia login --host http://localhost:3000
```

Useful commands:

| Command | What it does |
| --- | --- |
| `fcsia whoami` | Show the signed-in person and site. |
| `fcsia sessions list` | List CLI sign-ins on your account. |
| `fcsia sessions revoke <session>` | Sign one out. |
| `fcsia logout` | Remove the sign-in saved on this computer. |

A token can also come from `--token` or the `FCSIA_TOKEN` variable. The
`FCSIA_TOKEN` variable is preferred for scripts because it keeps the token out
of shell history. `--host` and `FCSIA_HOST` choose the site; the host saved at
login is the next fallback, then `https://app.fcsia.com`.

## Output and exit codes

The CLI follows one output contract:

- **stdout is the answer.** Lists, detail views, JSON documents, and version
  numbers go to stdout.
- **stderr is context.** Confirmations, progress, warnings, empty-result
  messages, and next steps go to stderr.
- **Piped lists are tab-separated** with one header row, so `cut`, `awk`, and
  `column -t` work without `--json`.
- **`--json` prints one document** on stdout. In JSON mode, stderr stays empty
  unless there is an error; errors are JSON documents on stderr.

| Exit code | Meaning |
| --- | --- |
| `0` | The command completed. An empty result is still success. |
| `1` | The command failed (not signed in, no permission, not found, network, and so on). |
| `2` | The command line was wrong, or required input is missing. |
| `130` | A prompt was declined or the process received Ctrl-C. |

Every error has a stable `reason` code. In JSON mode:

```json
{
  "status": "error",
  "reason": "not_signed_in",
  "message": "You're not signed in to https://app.fcsia.com.",
  "next": [{ "command": "fcsia login", "argv": ["fcsia", "login"] }],
  "userActionRequired": true
}
```

Global options:

| Option | Meaning |
| --- | --- |
| `--json` | Print the result as JSON on commands that support it. |
| `--host <URL>` | Use another IA App site. |
| `--token <TOKEN>` | Use a session token directly. |
| `--global-config <DIR>` | Keep settings and sign-ins in another directory. |
| `--yes`, `-y` | Approve a destructive action without asking. |
| `--non-interactive` | Never prompt; fail with the missing input instead. |
| `--no-color` | Turn off color. `NO_COLOR` also works. |
| `--debug`, `-d` | Print redacted diagnostics on stderr. |
| `--help`, `-h` | Show help. Works offline and needs no sign-in. |
| `--version`, `-v` | Print the CLI version. |

Prompts appear only on a terminal. CI, an agent environment, `--json`, and
`--non-interactive` turn them off. A destructive command without `--yes` then
fails with `confirmation_required` and prints the exact command to run with
`--yes`.

## Commands

Run `fcsia --help` for the command tree, `fcsia <command> --help` for one
command, or `fcsia help --all` for every command. `fcsia help search <words>`
finds commands by what they do. `fcsia <command> --help --json` returns the
same contract as a document for scripts.

### Your day

| Command | What it does |
| --- | --- |
| `fcsia today` | Show today's school day and your classes. |
| `fcsia schedule inspect [date]` | Show one school day, as `YYYY-MM-DD`, `today`, or `tomorrow`. Defaults to today. |
| `fcsia notifications list [--unread] [--limit N]` | List your notifications. The default limit is 50. |
| `fcsia notifications read <notification>` | Mark one read and print its link. |

### Announcements

| Command | What it does |
| --- | --- |
| `fcsia announcements list [--unread] [--limit N]` | Read announcements you can see. |
| `fcsia announcements inspect <announcement>` | Read one announcement and its comments. |
| `fcsia announcements create --title TEXT (--body TEXT \| --body-file FILE)` | Write an announcement. |
| `fcsia announcements approve <announcement>` | Publish a club announcement waiting for approval. |
| `fcsia announcements reject <announcement> [--note TEXT]` | Turn one down with an optional note. |

`announcements create` targets the whole school by default. `--grade`,
`--major`, `--minor`, and `--club` narrow the audience; grades and pathways
together produce the web app's intersection audience. `--comments` allows
comments, `--general` marks an administration notice, `--promoted` pins it for
30 days, and `--expires YYYY-MM-DD` sets the last day it shows. `--body-file -`
reads the text from standard input.

A club announcement from someone who is not a sponsor waits for a sponsor's
approval.

### Events

| Command | What it does |
| --- | --- |
| `fcsia events list [--all] [--limit N]` | List upcoming events. `--all` includes events that already started. |
| `fcsia events inspect <event>` | Read one event. |
| `fcsia events cancel <event>` | Cancel an event you can manage. |

### Flex Friday

| Command | What it does |
| --- | --- |
| `fcsia flex sessions list [--limit N]` | List Flex Friday days. |
| `fcsia flex workshops list <friday>` | Show the workshops on one Flex day. |
| `fcsia flex registrations list` | List the workshops you are registered for. |
| `fcsia flex registrations add <workshop>` | Register for a workshop. |
| `fcsia flex registrations remove <workshop>` | Drop a registration. |

Use `flex workshops list` to find workshop IDs before registering.

### Clubs and search

| Command | What it does |
| --- | --- |
| `fcsia clubs list` | List your clubs. |
| `fcsia clubs inspect <club>` | Show one club. |
| `fcsia clubs channels list <club>` | List a club's channels. |
| `fcsia clubs messages list <channel> [--limit N]` | Read a channel's messages. The default limit is 30. |
| `fcsia clubs messages send <channel> <message>...` | Send a plain-text message. |
| `fcsia clubs messages follow <channel>` | Watch a channel for new messages until Ctrl-C. |
| `fcsia search <query>...` | Find people and club channels. |

`clubs messages follow` prints each new message as it arrives. With `--json`,
each message is one JSON document, so a pipe sees one object per line.
Markdown, mentions, attachments, replies, and polls stay on the web.

### Staff and administration

The CLI uses exactly the web app's permissions. A command that lists an empty
queue usually means the signed-in account cannot see that queue.

| Command | What it does |
| --- | --- |
| `fcsia users list [--search TEXT] [--group GROUP] [--limit N]` | Browse the school directory. Groups: `students`, `teachers`, `student-admin`, `other`, `all`. |
| `fcsia users inspect <user>` | Show one person. Accepts a student ID or internal user ID. |
| `fcsia users activate <user>` | Let a deactivated person sign in again. |
| `fcsia users deactivate <user>` | Sign a person out and block new sign-ins. |
| `fcsia users delete <user>...` | Permanently delete one or more accounts. |
| `fcsia users export` | Print the student roster as CSV. |
| `fcsia users import <file>` | Create student accounts from CSV; `--dry-run` checks without creating. |
| `fcsia users roles set <user> --role ROLE` | Replace a person's roles. Repeat `--role` for more. |
| `fcsia users passwords reset <user>` | Give a person a temporary password. |
| `fcsia audit list [options]` | Read the audit log. Filter by `--query`, `--action`, `--actor`, `--entity`, `--since`, and `--until`. |
| `fcsia audit inspect <event>` | Show one audit event. |
| `fcsia feedback list [--status STATUS] [--limit N]` | Read general feedback. Statuses: `pending`, `in_review`, `resolved`, `dismissed`. |
| `fcsia feedback inspect <feedback>` | Show one feedback report and its replies. |
| `fcsia feedback respond <feedback> <message>...` | Reply to the submitter. |
| `fcsia reports list [--status STATUS] [--club ID] [--escalated] [--limit N]` | Read reports about content and messages. |
| `fcsia reports inspect <report>` | Show one report. |
| `fcsia reports update <report> --status STATUS [--note TEXT]` | Resolve, dismiss, or reopen a report. |

`users export` writes the canonical roster columns:

```text
student_id,first_name,last_name,email,grade_level,major,minor
```

`users import` reads the same columns. `student_id`, `first_name`, and
`last_name` are required; `email`, `grade_level`, `major`, and `minor` are
optional. Pathways accept the enum value (`INFORMATION_TECHNOLOGY`), its label,
or `IT`, `HS`, and `ENG`. A path or `-` for standard input works. Imported
students receive temporary passwords, which are printed once.

`reports` is the content-report queue (announcements, events, and club
messages); `feedback` is general feedback. `reports update` sends the status it
read, so two reviewers cannot silently overwrite each other.

### Sessions and setup

| Command | What it does |
| --- | --- |
| `fcsia sessions list` | List CLI sign-ins on your account. |
| `fcsia sessions revoke <session>` | Sign one out. |
| `fcsia cli alias set <name> [--dir DIR] [--force]` | Add another name, such as `ia`. |
| `fcsia cli alias inspect` | Show the saved alias. |
| `fcsia cli alias remove` | Remove it. |
| `fcsia completion <shell>` | Print a completion script for `bash`, `zsh`, or `fish`. |
| `fcsia upgrade [--check]` | Update the compiled CLI. |
| `fcsia help [command]...` | Show help. |

## Shell completion

Completion is registry-driven: the script asks the CLI for candidates through a
hidden `fcsia __complete` command, so new commands appear after an upgrade
without regenerating the script.

Bash, in `~/.bashrc`:

```sh
eval "$(fcsia completion bash)"
```

zsh, saving the script on your `fpath`:

```sh
fcsia completion zsh > "${fpath[1]}/_fcsia"
```

fish:

```sh
fcsia completion fish > ~/.config/fish/completions/fcsia.fish
```

Restart the shell after installing a zsh or fish completion file.

## JSON

Every read and mutation that supports `--json` returns one JSON document. The
shapes are command-specific and cleaned for scripts: remote text is stripped of
control characters, IDs are plain strings, and each list document names its
items, such as `announcements` or `users`. Some list documents also report
`total` and `showing` when a limit applied.

Use help as the machine-readable contract:

```sh
fcsia announcements list --help --json
fcsia help --all --json
```

The help document describes the usage, arguments, options, examples, and
whether the command supports `--json`, all from the same registry the parser
uses. Help never reads settings, signs in, or touches the network.

## Scripting

A script can stay fully non-interactive:

```sh
FCSIA_TOKEN="$TOKEN" fcsia reports list --status PENDING --json
FCSIA_TOKEN="$TOKEN" fcsia events cancel "$EVENT" --yes --json
```

- Set `FCSIA_TOKEN` rather than passing `--token` so the token is not in the
  process list.
- Add `--non-interactive` when a command might otherwise prompt. Destructive
  commands still need `--yes`.
- Read `reason` from an error document to branch on failures.
- Use `--host` or `FCSIA_HOST` for a development site.
- Set `FCSIA_CONFIG_DIR` to keep a script's settings and sign-ins separate.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| `not_signed_in` or `session_expired` | Run `fcsia login`. Check `fcsia whoami` for the site. |
| `cli_outdated` | Run `fcsia upgrade`. |
| `confirmation_required` | Re-run the printed command with `--yes` after checking what it changes. |
| `invalid_config` | The named file is not valid JSON. Fix or remove it; the CLI will not silently reset it. |
| A keyring prompt hangs in a container | Set `FCSIA_CREDENTIAL_STORE=file`. |
| No color when expected | Check `NO_COLOR`, `TERM=dumb`, and whether stdout is a terminal. |

## Development

The CLI lives in `apps/cli` and runs with Bun:

```sh
direnv exec . bun run --filter @fcsia/cli test
direnv exec . bun run --filter @fcsia/cli typecheck
direnv exec . bun run --filter @fcsia/cli lint
direnv exec . bun apps/cli/src/main.ts --help
```

A release build compiles one binary per platform:

```sh
bun build apps/cli/src/main.ts --compile --minify \
  --target bun-darwin-arm64 \
  --define '__FCSIA_CLI_VERSION__="0.5.0"' \
  --outfile dist/cli/fcsia-darwin-arm64
```

The release workflow runs that command for macOS (Intel and Apple Silicon),
Linux (x64 and arm64), and Windows (x64), then attaches the binaries and
`SHA256SUMS` to the GitHub release. `scripts/package-cli-npm.mjs` turns the same
binaries into `@fcsia/cli` plus one optional platform package per build.

Known follow-ups:

- npm Trusted Publishing is implemented as a release step but not enabled; a
  Nix `packages.fcsia` is not built yet. Use the install script or a release
  download.
- The backend still throws plain error messages for most failures. The CLI maps
  the ones people act on to stable reasons; the long-term fix is structured
  `ConvexError` codes shared with the web app.
- `clubs messages follow` is covered only up to its preflight check in tests
  because the fake backend is HTTP-only. Try it against a real site before
  relying on it.
