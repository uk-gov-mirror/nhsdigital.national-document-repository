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
      bc

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

RUN wget https://github.com/mikefarah/yq/releases/download/v4.48.2/yq_linux_amd64 -O /usr/bin/yq && chmod +x /usr/bin/yq
RUN wget https://github.com/asdf-vm/asdf/releases/download/v0.18.0/asdf-v0.18.0-linux-amd64.tar.gz -O - | tar xz && sudo mv asdf /usr/local/bin/asdf

# Install Cypress globally
RUN npm install -g cypress@15.7.0

# Installing ASDF
USER vscode
RUN echo "export ASDF_DATA_DIR=/home/vscode/.asdf" >> ~/.bashrc
RUN echo ". <(asdf completion bash)"  >> ~/.bashrc

# Install poetry
RUN curl -sSL https://install.python-poetry.org | POETRY_VERSION=2.2.1 python3

# ASDF and poetry added to path in devcontainer.json
