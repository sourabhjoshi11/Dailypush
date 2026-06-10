#!/usr/bin/env bash
set -euo pipefail

# Ensure Rust/Cargo write paths point to /tmp to avoid read-only filesystem issues on Render
export CARGO_HOME=${CARGO_HOME:-/tmp/cargo}
export RUSTUP_HOME=${RUSTUP_HOME:-/tmp/rustup}
export XDG_CACHE_HOME=${XDG_CACHE_HOME:-/tmp}

# Upgrade packaging tools and install requirements
python -m pip install --upgrade pip wheel setuptools
python -m pip install -r requirements.txt

echo "Dependencies installed successfully using temporary Cargo/Rust dirs."