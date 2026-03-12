# Contributing

Thank you for your interest in Omni-Agent Protocol!

## Development Setup

1. Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Install Node.js
```bash
nvm install 20
```

3. Install pnpm
```bash
corepack enable && corepack prepare pnpm@8.15.0 --activate
```

4. Clone and setup
```bash
git clone https://github.com/omni-agent-protocol/omni-agent-protocol.git
cd omni-agent-protocol
pnpm install
```

## Making Changes

1. Create a branch
2. Make your changes
3. Add tests
4. Submit a PR

## Code Style

- Rust: Follow rustfmt
- TypeScript: Follow prettier
