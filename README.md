# KT (Keep Track)

A tracking application built with Tauri 2, Svelte 5, and shadcn-svelte.

## Useful Commands

```bash
# Start dev server
npm run tauri dev

# Build executable
npm run tauri build

# Run web-only dev server (no Tauri)
npm run dev
```

## Use this command



## Install Rust

curl https://sh.rustup.rs -sSf | sh -s -- -y
source "$HOME/.cargo/env"
rustc --version
cargo --version

## Install Tauri Linux

sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  librsvg2-dev \
  libssl-dev \
  build-essential \
  pkg-config \
  curl \
  wget \
  file


## Requirements

- Node.js (via nvm recommended)
- Rust
- Tauri CLI (installed as a dev dependency)

### Windows
Install MSVC before other dependencies (check **"Desktop development with C++"** workload):
- [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)
- [Rust](https://www.rust-lang.org/tools/install)
- [Visual Studio Community](https://visualstudio.microsoft.com/vs/community/)

> Note: Tauri on Windows requires the MSVC build tools.

### Linux
- [nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating)
- [Rust](https://www.rust-lang.org/tools/install)

System deps (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  librsvg2-dev
