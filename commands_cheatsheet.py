def show_commands():
    commands = {
        "pnpm dev": "Starts the local development server (runs both the web app and convex backend). This is what we ran earlier to see your app locally.",
        "pnpm install": "Installs or updates the dependencies if they've changed.",
        "git pull": "Pulls the latest code from the remote repository (e.g. from Github/Vercel) to your local machine.",
        "git stash": "Temporarily saves your uncommitted changes so you can switch branches or pull without conflicts.",
        "git stash drop": "Deletes the stashed changes permanently.",
        "git checkout main": "Switches your current working branch to the main branch.",
        "turbo run build": "Builds the web app for production.",
        "turbo run lint": "Lints the code to check for formatting and syntax errors."
    }

    print("=== IA-APP BASIC COMMANDS CHEATSHEET ===\n")
    for cmd, desc in commands.items():
        print(f"Command:  {cmd}")
        print(f"What it does: {desc}\n")
    print("========================================")

if __name__ == "__main__":
    show_commands()
