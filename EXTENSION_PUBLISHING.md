# Publishing the CollabCode VS Code extension

The generated `.vsix` is an installable package, but it is not automatically
available to everyone. Public discovery and one-click installation require a
Visual Studio Marketplace publisher and a Marketplace release.

1. Create or select a publisher at `marketplace.visualstudio.com/manage`.
2. Change `publisher` in `packages/extension/package.json` to that exact
   publisher ID.
3. Create an Azure DevOps personal access token with Marketplace **Manage**
   scope. Keep it outside the repository.
4. From `packages/extension`, run:

   ```powershell
   pnpm exec vsce login YOUR_PUBLISHER_ID
   pnpm run package
   pnpm exec vsce publish
   ```

5. Confirm the Marketplace listing, install it into a clean VS Code profile,
   and configure `collabcode.serverUrl` with the deployed HTTPS server URL.

Increment the extension version before each later release. Never commit the
Marketplace token.
