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
        # Use the official binaries so the pinned Nix snapshot cannot supply
        # older shared Brotli, OpenSSL, or c-ares libraries to the runtime.
        nodeVersion = pkgs.lib.removeSuffix "\n" (builtins.readFile ./.node-version);
        nodePlatforms = {
          aarch64-darwin = {
            platform = "darwin-arm64";
            hash = "sha256-ZUunneYVVkfiIyGTK0Xyocy3BZdswzfJuOJ4vrCFpig=";
          };
          x86_64-darwin = {
            platform = "darwin-x64";
            hash = "sha256-ZeRQ+Qpuqs1QAPYRhhxM5l+tyH+BN5XcTtDA5fL8otQ=";
          };
          aarch64-linux = {
            platform = "linux-arm64";
            hash = "sha256-26v3ocv5R+YFn/rSwnuABB25feoeVTtir97n8T/KM24=";
          };
          x86_64-linux = {
            platform = "linux-x64";
            hash = "sha256-bBcqmrZxj3uAH7WnvUhq8u5eMnWAhqBLhPzOKqdwleY=";
          };
        };
        nodePlatform = nodePlatforms.${system};
        projectNode = pkgs.stdenvNoCC.mkDerivation {
          pname = "nodejs";
          version = nodeVersion;
          src = pkgs.fetchurl {
            url = "https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-${nodePlatform.platform}.tar.xz";
            hash = nodePlatform.hash;
          };
          nativeBuildInputs = pkgs.lib.optionals pkgs.stdenv.isLinux [ pkgs.autoPatchelfHook ];
          buildInputs = pkgs.lib.optionals pkgs.stdenv.isLinux [ pkgs.stdenv.cc.cc.lib ];
          dontBuild = true;
          installPhase = ''
            runHook preInstall
            mkdir -p "$out"
            cp -r bin include lib share "$out/"
            runHook postInstall
          '';
        };
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
                  hash = "sha256-wkDX8My5DCY6hJ/NsJt+5iYw2SE0jtaq/ahrnVd7xRA=";
                };
                x86_64-darwin = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${finalAttrs.version}/bun-darwin-x64-baseline.zip";
                  hash = "sha256-1KFVrfv9CRVes7oFyeOlRPOSl9emhhbTx3WfZ6tcR9w=";
                };
                aarch64-linux = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${finalAttrs.version}/bun-linux-aarch64.zip";
                  hash = "sha256-uqa7NvUdblhWHgK76oJQOKnfRU9nPW13bou/hvjHhQ4=";
                };
                x86_64-linux = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${finalAttrs.version}/bun-linux-x64.zip";
                  hash = "sha256-v4zL+ysLgBWeD5ptFcVTF63YB3U028YTCj7bUvzLOVw=";
                };
              };
            };
          }
        );
      in
      {
        formatter = pkgs.nixfmt;

        devShells.default = pkgs.mkShell {
          packages =
            (with pkgs; [
              projectNode
              projectBun
              openssl
              pkg-config
              gh
            ])
            ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [ pkgs.cocoapods ];
        };
      }
    );
}
