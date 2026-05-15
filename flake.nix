{
  inputs = {
    nixpkgs.url = "https://flakehub.com/f/DeterminateSystems/nixpkgs-weekly/0.tar.gz";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        formatter = pkgs.nixfmt;

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_20
            pnpm
            postgresql_16
            openssl
            pkg-config
          ];

          shellHook = ''
            export PGDATA=$PWD/.pgdata

            # Setup DB if it doesn't exist
            if [ ! -d "$PGDATA" ]; then
              echo "Initializing local PostgreSQL database in .pgdata..."
              initdb -D "$PGDATA" -U postgres
            fi

            # Start this repo's DB if its data directory is not already running.
            if ! pg_ctl status -D "$PGDATA" > /dev/null 2>&1; then
              echo "Starting local PostgreSQL..."
              if ! pg_ctl start -w -t 10 -D "$PGDATA" -l "$PGDATA/postgres.log"; then
                echo "Failed to start repo-local PostgreSQL from $PGDATA."
                echo "If another PostgreSQL server is using localhost:5432, stop it or update this flake and DATABASE_URL to use a different port."
                echo "See $PGDATA/postgres.log for details."
                return 1 2>/dev/null || exit 1
              fi
            fi

            echo "Setting up database user and role..."
            psql -U postgres -h localhost -d postgres -c "CREATE USER ia_user WITH PASSWORD 'ia_password';" 2>/dev/null || true
            psql -U postgres -h localhost -d postgres -c "CREATE DATABASE ia_db OWNER ia_user;" 2>/dev/null || true
            psql -U postgres -h localhost -d postgres -c "ALTER USER ia_user CREATEDB;" 2>/dev/null || true

            echo "✨ Repo-local PostgreSQL is running"
          '';
        };
      }
    );
}
