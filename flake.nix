{
  description = "OpenWorld (Large Symbolic World): development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [ pkgs.nodejs_24 ];
          shellHook = ''
            # Vite serves on `localhost`. Where that resolves to a ::1 that drops connections,
            # resolving IPv4 first makes it listen on 127.0.0.1 instead.
            export NODE_OPTIONS="--dns-result-order=ipv4first''${NODE_OPTIONS:+ $NODE_OPTIONS}"
            [ -d node_modules ] || echo "openworld: no node_modules yet; run npm ci"
          '';
        };
      });

      formatter = forAllSystems (pkgs: pkgs.nixfmt);
    };
}
