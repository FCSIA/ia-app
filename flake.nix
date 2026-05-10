{
  inputs = {
    nixpkgs.url = "https://flakehub.com/f/DeterminateSystems/nixpkgs-weekly/0.tar.gz";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, flake-utils, ... }:
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

            # Start DB if it's not already running
            if ! pg_isready -h localhost > /dev/null 2>&1; then
              echo "Starting local PostgreSQL..."
              pg_ctl start -D "$PGDATA" -l "$PGDATA/postgres.log" > /dev/null 2>&1

              echo "Waiting for postgres to be ready..."
              for i in {1..10}; do
                pg_isready -h localhost > /dev/null 2>&1 && break
                sleep 0.5
              done

              echo "Setting up database user and role..."
              psql -U postgres -h localhost -d postgres -c "CREATE USER ia_user WITH PASSWORD 'ia_password';" 2>/dev/null || true
              psql -U postgres -h localhost -d postgres -c "CREATE DATABASE ia_db OWNER ia_user;" 2>/dev/null || true
              psql -U postgres -h localhost -d postgres -c "ALTER USER ia_user CREATEDB;" 2>/dev/null || true
            fi

            echo "✨ PostgreSQL is running"
          '';
        };
      }
    );
}
