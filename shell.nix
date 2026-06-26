# Development shell for archon-reveng.
#
# One-step way to enable Mermaid diagram validation (spec §7.4 / §8): provides
# `mmdc` (mermaid-cli) together with a headless Chromium, and exports
# PUPPETEER_EXECUTABLE_PATH so the bundled Puppeteer drives the Nix-provided
# Chromium rather than downloading its own. Also provides Bun and Node, which
# run and test the deterministic control scripts (`template/scripts/*.ts`) and
# the workflow's `bun run` script/loop nodes.
#
# Manual alternative (without Nix): `npm i -g @mermaid-js/mermaid-cli` plus a
# system Chromium, exporting PUPPETEER_EXECUTABLE_PATH to its path.

{ pkgs ? import <nixpkgs> { } }:

pkgs.mkShell {
  packages = [
    pkgs.bun          # build + runtime: runs/tests the TS control scripts and `bun run` nodes
    pkgs.nodejs       # Node built-ins the scripts import; tooling host
    pkgs.mermaid-cli  # provides the `mmdc` binary for diagram validation
    pkgs.chromium     # headless Chromium that Puppeteer drives for `mmdc`
  ];

  # Point Puppeteer (used by mmdc) at the Nix-provided Chromium instead of one
  # it would otherwise download. The validator additionally passes --no-sandbox
  # via its Puppeteer config for sandboxed/CI/root contexts (spec §7.4).
  PUPPETEER_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";

  # Don't let an npm-installed Puppeteer fetch its own Chromium — use ours.
  PUPPETEER_SKIP_DOWNLOAD = "true";
}
