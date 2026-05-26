# IA App Setup Guide

## 1. Prerequisites
Ensure you have the following installed[^1]:
- **Node.js** (v24+)
- **pnpm** (v9+)

---

## 2. Environment Setup

### Clone the Repository
```bash
git clone https://github.com/virajdas/ia-app.git
cd ia-app
```

### Configure Environment
Create your local environment file:
```bash
cp .env.example .env
```

### Install Dependencies
```bash
pnpm install
```

---

## 3. Development Workflow

### Start the Application
Run the dev environment:
```bash
pnpm dev
```
- **Web App**: http://localhost:3000

### Open Convex Dashboard
To inspect your database, run:
```bash
pnpx convex dashboard
```

---

## 4. Platform-Specific Notes

### Nix + direnv
If you prefer a managed environment:
1. Ensure [Nix](https://nixos.org/download.html) and [direnv](https://direnv.net/) are installed.
2. Run `direnv allow` in the project root to load the environment automatically.

---

## 5. Test Accounts
All seed accounts use their ID as the password; e.g. `STU001` + `STU001`

[^1]: For Nix & direnv-based setups, this will not be necessary. Running `direnv allow` will install all required dependencies locally.
