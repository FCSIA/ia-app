# app

## Setup

Choose either setup path; both create the same project-local `.venv`:

- With Nix and `direnv`: run `direnv allow`. You can use `nix develop` instead if you do
  not want the automatic directory hook.
- Without Nix: install [`uv`](https://docs.astral.sh/uv/getting-started/installation/) and
  run `uv sync`. `uv` can install a compatible Python version when needed.

After setup, use the commands below on macOS, Linux, or Windows. Nix is not required to
work on the project.

## Python deps

This project uses `uv`.

- Add dependencies with `uv add <package>`
- Sync the environment with `uv sync`
- Generate or refresh the lockfile with `uv lock`

Commit `uv.lock` so Nix and non-Nix contributors resolve the same Python dependencies.
