FROM --platform=linux/amd64 mcr.microsoft.com/devcontainers/python:3.11

RUN apt-get update && apt-get upgrade -y && apt-get install -y \
  git \
  jq \
  rsync \
  tree \
  unzip \
  wget \
  strip-nondeterminism \
  uuid-runtime \
  parallel \
  bc \
  curl \
  ca-certificates \
  gnupg

# Prepare github-cli install
RUN mkdir -p /etc/apt/keyrings \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | gpg --dearmor \
  | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
  && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] \
  https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null

# Install CLI tools.
RUN apt-get update && apt-get install -y \
  vim \
  ranger \
  tmux \
  fzf \
  gh

# Install base neovim
RUN set -eux; \
  NEOVIM_VERSION="v0.11.6"; \
  curl -fsSL -o nvim.tar.gz \
  https://github.com/neovim/neovim/releases/download/${NEOVIM_VERSION}/nvim-linux-x86_64.tar.gz; \
  tar -xzf nvim.tar.gz; \
  mv nvim-linux-x86_64 /opt/nvim; \
  ln -sf /opt/nvim/bin/nvim /usr/local/bin/nvim; \
  rm nvim.tar.gz

# Install Lazygit
RUN set -eux; \
  LAZYGIT_VERSION="$(curl -s https://api.github.com/repos/jesseduffield/lazygit/releases/latest \
  | grep -Po '"tag_name": *"v\K[^"]*')" && \
  curl -Lo /tmp/lazygit.tar.gz \
  "https://github.com/jesseduffield/lazygit/releases/download/v${LAZYGIT_VERSION}/lazygit_${LAZYGIT_VERSION}_Linux_x86_64.tar.gz" && \
  tar -xf /tmp/lazygit.tar.gz -C /tmp lazygit && \
  install /tmp/lazygit /usr/local/bin/lazygit && \
  rm -rf /tmp/lazygit /tmp/lazygit.tar.gz

# Install Node.js (needed for Cypress)
RUN apt-get update && apt-get install -y curl gnupg && \
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
  apt-get install -y nodejs

# Install Cypress GUI dependencies
RUN apt-get install -y \
  xvfb \
  libgtk-3-0 \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libasound2

RUN wget https://github.com/mikefarah/yq/releases/download/v4.52.4/yq_linux_amd64 -O /usr/bin/yq && chmod +x /usr/bin/yq
RUN wget https://github.com/asdf-vm/asdf/releases/download/v0.18.0/asdf-v0.18.0-linux-amd64.tar.gz -O - | tar xz && sudo mv asdf /usr/local/bin/asdf

# Install Cypress globally
RUN npm install -g cypress@15.10.0

# Installing ASDF
USER vscode
RUN echo "export ASDF_DATA_DIR=/home/vscode/.asdf" >> ~/.bashrc
RUN echo ". <(asdf completion bash)"  >> ~/.bashrc

# Install poetry
RUN curl -sSL https://install.python-poetry.org | POETRY_VERSION=2.3.2 python3

# ASDF and poetry added to path in devcontainer.json
