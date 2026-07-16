# Kairo desktop app

The desktop app is a locked-down Electron shell for the production Kairo site at
`https://kairo.despacho.io`. Server credentials remain on Vercel and are not
included in the installer.

## Build the Windows installer

Run:

```sh
npm run desktop:build:win
```

The installer is written to `dist-desktop/Kairo-Setup-<version>.exe`.

## Release checklist

1. Verify `https://kairo.despacho.io` is the intended production deployment.
2. Test login, logout, downloads, invoices, payments, and keyboard shortcuts on Windows 11.
3. Sign the installer with a Windows code-signing certificate before team-wide distribution.
4. Distribute the installer only through a controlled internal location.
5. Rebuild and redistribute promptly when Electron receives security updates.

Never add Supabase service-role, Stripe secret, Google private-key, cron, or
other server credentials to this directory or to Electron configuration.
