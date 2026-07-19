# Kairo for iPhone

Kairo's iPhone app is a native Capacitor shell for the production Kairo service.
It uses the same Supabase accounts, data, Row Level Security policies, and role
rules as the browser and desktop applications.

## Mobile access

- **Super Admin:** complete Kairo access, including invoices.
- **Admin:** operational access without invoices or invoice actions.
- **Manager and Employee:** the iPhone app rejects the login and signs the
  session out.

The app performs the mobile role check immediately after authentication. The
authenticated layout repeats the check, route navigation filters out forbidden
pages, and Supabase policies remain the final authorization boundary. The iOS
bundle contains no Supabase service-role, Stripe, Gmail, cron, or Vercel secret.

## Configuration

The default production URL is `https://kairo.despacho.io`. To use another Kairo
deployment while synchronizing the Xcode project:

```bash
KAIRO_IOS_APP_URL=https://example.despacho.io npm run ios:sync
```

Only HTTPS is enabled. The native web view is restricted to the configured
Kairo hostname.

## Build and test

1. Install the current full version of Xcode from Apple.
2. Open Xcode once and finish installing its additional components.
3. If necessary, select it for command-line builds:

   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```

4. Synchronize native files whenever Capacitor configuration or plugins change:

   ```bash
   npm run ios:sync
   ```

5. Open the project:

   ```bash
   npm run ios:open
   ```

6. In Xcode, select the **App** target and configure **Signing & Capabilities**:
   choose the Despacho Inc Apple Developer team and confirm the bundle identifier
   `com.despacho.kairo`.
7. Select an iPhone simulator or connected iPhone and press **Run**.

## TestFlight and private release

Before archiving, set the version and build number in the Xcode App target.
Then select **Any iOS Device (arm64)**, choose **Product > Archive**, and use the
Organizer to upload the archive to App Store Connect. Use TestFlight for the
beta and Apple Business Manager Custom App distribution for Despacho's private
release.

Test these cases before each release:

- Super Admin can sign in and reach invoices.
- Admin can sign in but cannot see or open invoice routes.
- Manager and Employee credentials are rejected and signed out.
- Logout removes the app session.
- Dashboard, timer, team, clients, projects, reports, and settings work on an
  iPhone-sized screen.
