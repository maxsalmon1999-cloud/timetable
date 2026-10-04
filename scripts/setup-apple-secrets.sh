#!/bin/bash
# Puts the Apple signing + notarisation secrets on GitHub so the Release workflow can sign and notarise Timetable.
# Max runs this himself in Terminal (agents don't write credentials to the secret store). Re-run it if the
# certificate is renewed or the app-specific password changes.
#
#   bash scripts/setup-apple-secrets.sh                 # exports the certificate from the keychain itself
#   bash scripts/setup-apple-secrets.sh ~/Desktop/devid.p12   # or use one exported by hand from Keychain Access
#
# Run it in the Terminal app, not inside Claude: macOS shows a window to allow the export, and the script asks
# two questions.
#
# Needs: the "Developer ID Application" certificate in the login keychain, `gh` logged in, and an app-specific
# password from https://account.apple.com → Sign-In and Security → App-Specific Passwords.
set -euo pipefail

REPO=maxsalmon1999-cloud/timetable
D=$(mktemp -d)
chmod 700 "$D"
TMPKC="$D/tmp.keychain-db"
cleanup() {
  security delete-keychain "$TMPKC" 2>/dev/null || true
  rm -rf "$D"
}
trap cleanup EXIT

# random passwords for the temporary files; never shown
P1=$(openssl rand -hex 24)
P2=$(openssl rand -hex 24)
KP=$(openssl rand -hex 24)

if [ $# -ge 1 ]; then
  # a .p12 exported by hand from Keychain Access (My Certificates → right-click → Export…)
  echo "1/3  Using $1"
  read -r -s -p "     The password you gave that .p12 when exporting it: " P1
  echo
  cp "$1" "$D/all.p12"
else
  echo "1/3  Exporting the Developer ID Application certificate."
  echo "     macOS will ask for your Mac login password to allow this. Type it in that window."
  if ! security export -k ~/Library/Keychains/login.keychain-db -t identities -f pkcs12 -P "$P1" -o "$D/all.p12"; then
    echo
    echo "macOS wouldn't export it this way. Export it by hand instead:" >&2
    echo "  Keychain Access → login → My Certificates → right-click \"Developer ID Application: Max Salmon\"" >&2
    echo "  → Export… → save to the Desktop as devid.p12 with a password you make up. Then run:" >&2
    echo "  bash ~/Documents/timetable/scripts/setup-apple-secrets.sh ~/Desktop/devid.p12" >&2
    exit 1
  fi
fi

# keep only the Application identity (the Installer one isn't needed), via a throwaway keychain
security create-keychain -p "$KP" "$TMPKC"
security unlock-keychain -p "$KP" "$TMPKC"
security import "$D/all.p12" -k "$TMPKC" -P "$P1" -A >/dev/null
security delete-identity -c "Developer ID Installer" "$TMPKC" >/dev/null 2>&1 || true
if ! security find-identity -v "$TMPKC" | grep -q "Developer ID Application"; then
  echo "Couldn't find the Developer ID Application certificate. Make it in Xcode → Settings → Apple Accounts → Manage Certificates." >&2
  exit 1
fi
security export -k "$TMPKC" -t identities -f pkcs12 -P "$P2" -o "$D/app.p12"
base64 -i "$D/app.p12" | gh secret set APPLE_CERTIFICATE --repo "$REPO"
printf %s "$P2" | gh secret set APPLE_CERTIFICATE_PASSWORD --repo "$REPO"
echo "     Certificate uploaded."

echo
read -r -p "2/3  The email address of your Apple developer account: " APPLE_ID
printf %s "$APPLE_ID" | gh secret set APPLE_ID --repo "$REPO"

echo
read -r -s -p "3/3  Paste the app-specific password (it won't show as you paste), then press Return: " APPLE_PASSWORD
echo
printf %s "$APPLE_PASSWORD" | gh secret set APPLE_PASSWORD --repo "$REPO"

echo
[ $# -ge 1 ] && echo "You can delete $1 now."
echo "Done. Secrets on GitHub now:"
gh secret list --repo "$REPO"
