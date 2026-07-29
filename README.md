# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## MCP server

`mcp-server/` is a standalone MCP server (own `package.json`, run via `tsx`) that lets an MCP client read
this app's content (modules/lessons/wiki/exercises), read an exported progress file, and author new content
(draft + publish modules, lessons, questions, wiki entries, Code Lab exercises) directly against
`src/content/**`, including a `publish_content`/`publish_practice_set` step that commits and pushes to
`main`. Full tool list and setup:

- **Claude Code**: a project-scoped `.mcp.json` is checked into the repo root, so opening this repo in
  Claude Code offers the `sap-quest` server automatically (approve it once via the trust prompt, or check
  status with `claude mcp list`).
- **Claude Desktop**: see [`mcp-server/README.md`](mcp-server/README.md) ("Cấu hình Claude Desktop") for the
  `claude_desktop_config.json` entry — it needs an absolute path since Desktop has no project-root concept.

See [`mcp-server/README.md`](mcp-server/README.md) for the complete tool table and the intended usage flow
(export progress → analyze → draft a practice set → publish).
