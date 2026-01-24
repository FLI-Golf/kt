FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Install Tauri Linux dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    librsvg2-dev \
    libssl-dev \
    build-essential \
    pkg-config \
    curl \
    wget \
    file \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Rust for the vscode user
USER vscode
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/home/vscode/.cargo/bin:${PATH}"

USER root
