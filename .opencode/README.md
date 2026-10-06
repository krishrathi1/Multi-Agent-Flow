# OpenCode integration

Nexus integrates with the official OpenCode CLI when it is installed on the host.

- Install: `npm install -g opencode-ai@latest`
- Check: `opencode --version`
- Models: `opencode models --verbose`
- Configure provider credentials through OpenCode's `/connect` flow.

Nexus exposes installation/status/model discovery in **Settings → API & Models → OpenCode**.

OpenCode configuration uses environment substitution so credentials and model choices are not committed to this repository.
