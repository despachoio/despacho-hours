# Kairo Timer desktop app

Kairo Timer is a locked-down Windows notification-area and macOS menu-bar app.
It opens the dedicated personal timer at
`https://kairo.despacho.io/desktop-timer`, keeps running when its window is
closed, and provides tray actions to open the timer, open the full Kairo site,
log out, or quit. Server credentials remain on Vercel and are not included in
the installer.

## Build the Windows installer

Run:

```sh
npm run desktop:build:win
```

The installer is written to `dist-desktop/Kairo-Timer-Setup-<version>.exe`.

## Build the macOS installer

For Apple Silicon Macs, run:

```sh
npm run desktop:build:mac
```

For one installer that supports both Apple Silicon and Intel Macs, run:

```sh
npm run desktop:build:mac:universal
```

The DMG is written to `dist-desktop/Kairo-Timer-<version>-<architecture>.dmg`.

If the build environment cannot create disk images, build a ZIP containing the
Mac application instead:

```sh
npm run desktop:build:mac:zip
```

## Release checklist

1. Deploy the web update containing `/desktop-timer`.
2. Apply `202607160002_tray_timer.sql` to the linked Supabase project.
3. Verify `https://kairo.despacho.io` is the intended production deployment.
4. Test login, start, pause, resume, stop, logout, and single-timer protection on Windows 11 and macOS.
5. Sign Windows installers with a Windows code-signing certificate before team-wide distribution.
6. Sign and notarize macOS installers with an Apple Developer ID certificate before team-wide distribution.
7. Distribute installers only through a controlled internal location.
8. Rebuild and redistribute promptly when Electron receives security updates.

Never add Supabase service-role, Stripe secret, Google private-key, cron, or
other server credentials to this directory or to Electron configuration.
