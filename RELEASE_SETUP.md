# JauniDeck release setup

The desktop shell and confirmation-based update flow are implemented.

Release prerequisites:

1. Create/connect the release repository.
2. Configure the Electron Builder publish provider for that repository.
3. Build Windows on a Windows runner and macOS on a macOS runner.
4. Sign Windows releases and sign/notarize macOS releases before public sale.
5. Publish release notes with each version; the app displays them before download.

Tester settings and uploaded icons are stored separately from the installation files and remain after updates.
