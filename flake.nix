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
        packageManager = (builtins.fromJSON (builtins.readFile ./package.json)).packageManager;
        projectBun = pkgs.bun.overrideAttrs (
          finalAttrs: previousAttrs: {
            version = pkgs.lib.removePrefix "bun@" packageManager;
            src = finalAttrs.passthru.sources.${system};
            passthru = previousAttrs.passthru // {
              # Release asset digests from oven-sh/bun; keep these in sync with packageManager.
              sources = {
                aarch64-darwin = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${finalAttrs.version}/bun-darwin-aarch64.zip";
                  hash = "sha256-2LliIYKK1vl6x6wKt+lYcjQa92MAHogD6CZ2UsJlJiA=";
                };
                x86_64-darwin = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${finalAttrs.version}/bun-darwin-x64-baseline.zip";
                  hash = "sha256-PjWtb1OXGpg0v55nhuKt9ytfGSHMmpxf3gc9KXKUQHY=";
                };
                aarch64-linux = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${finalAttrs.version}/bun-linux-aarch64.zip";
                  hash = "sha256-on/7Y6gxA3WDbg1vZorhf6jY0YuIw3yCHGUzGXOhmjs=";
                };
                x86_64-linux = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${finalAttrs.version}/bun-linux-x64.zip";
                  hash = "sha256-lR7iruhV8IWVruxiJSJqKY0/6oOj3NZGXAnLzN9+hI8=";
                };
              };
            };
          }
        );
      in
      {
        formatter = pkgs.nixfmt;

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            projectBun
            openssl
            pkg-config
            cocoapods
            gh
          ];
        };
      }
    );
}
