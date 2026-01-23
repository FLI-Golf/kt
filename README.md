# KT (Keep Track)

A tracking application built with Tauri 2, Svelte 5, and shadcn-svelte.

## Requirements

- Node.js (via nvm recommended)
- Rust

### Windows
Install MSVC before other dependencies (check "Desktop development with C++" workload):
- [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)
- [Rust](https://www.rust-lang.org/tools/install)
- [Visual Studio Community](https://visualstudio.microsoft.com/vs/community/)

### Linux/macOS
- [nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating)
- [Rust](https://www.rust-lang.org/tools/install)

## Setup

```bash
git clone https://github.com/FLI-Golf/kt.git
cd kt
npm i
```

## Development

```bash
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Adding Components

```bash
npx shadcn-svelte@next add <component>
```

See [shadcn-svelte components](https://next.shadcn-svelte.com/docs/components) for available options.

## License

MIT - see [LICENSE](LICENSE)
