#!/bin/bash

echo "Installing ASDF plugins and tools defined in .tool-versions."
echo "If this is the first time you've launched this devcontainer it might take a little while."
echo

# Install all the asdf plugins needed for tooling in the .tool-versions file.
make install-dev

# Add MOTD style helper
BASENAME=$(basename "$HOST_PWD")
echo -e "\n. /workspaces/$BASENAME/.devcontainer/src/motd.sh\n" | tee -a ~/.bashrc ~/.profile
echo 'alias av="aws-vault"' | tee -a ~/.bashrc ~/.profile

# Required for code signing and is in '' to delay evaluation intentionally
# shellcheck disable=SC2016
echo 'export GPG_TTY=$(tty)' | tee -a ~/.bashrc ~/.profile

# Preserve/append history across subshells
echo 'shopt -s histappend' | tee -a ~/.bashrc ~/.profile
echo "PROMPT_COMMAND='history -a'" | tee -a ~/.bashrc ~/.profile

# Add fuzzy find
echo 'eval "$(fzf --bash)"' | tee -a ~/.bashrc ~/.profile
