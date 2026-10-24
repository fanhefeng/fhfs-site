#!/usr/bin/env bash
# Official release digest: https://github.com/restic/restic/releases/tag/v0.19.1
# Cache only the archive; verify it again before extracting on every run.
set -euo pipefail

if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo 'This installer requires a Linux x86_64 runner.' >&2
  exit 1
fi

version=0.19.1
sha256=f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c
cache_dir=${1:?Usage: install-restic.sh archive-directory binary-directory}
install_dir=${2:?Usage: install-restic.sh archive-directory binary-directory}
asset="restic_${version}_linux_amd64.bz2"
archive="$cache_dir/$asset"
mkdir -p "$cache_dir" "$install_dir"
download=''
binary=''
trap 'rm -f "$download" "$binary"' EXIT

verify() {
  printf '%s  %s\n' "$sha256" "$1" | sha256sum --check --status
}

if [[ ! -f "$archive" ]] || ! verify "$archive"; then
  rm -f "$archive"
  download=$(mktemp "$cache_dir/download.XXXXXX")
  # Three attempts, each capped at 30 seconds, including stalled transfers.
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
    --connect-timeout 10 --max-time 30 --retry 2 --retry-delay 2 --retry-all-errors \
    --output "$download" "https://github.com/restic/restic/releases/download/v$version/$asset"
  if ! verify "$download"; then
    echo 'Official restic archive checksum verification failed.' >&2
    exit 1
  fi
  mv -f "$download" "$archive"
fi

binary=$(mktemp "$install_dir/restic.XXXXXX")
bzip2 --decompress --stdout "$archive" > "$binary"
chmod 755 "$binary"
mv -f "$binary" "$install_dir/restic"
"$install_dir/restic" version
echo "$install_dir" >> "${GITHUB_PATH:?GITHUB_PATH is required}"
