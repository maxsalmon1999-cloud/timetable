#!/bin/bash
# Puts the App Store Connect API key on GitHub so the TestFlight workflow can sign and upload the iPad app.
# Max runs this himself in the Terminal app (agents don't write credentials to the secret store):
#
#   bash ~/Documents/timetable/scripts/setup-testflight-secrets.sh ~/Downloads/AuthKey_XXXXXXXXXX.p8
#
# The key comes from App Store Connect → Users and Access → Integrations → App Store Connect API (Admin role).
set -euo pipefail

REPO=maxsalmon1999-cloud/timetable
P8=${1:-}
if [ -z "$P8" ] || [ ! -f "$P8" ]; then
  echo "Give the path to the downloaded key, e.g.: bash $0 ~/Downloads/AuthKey_ABC123XYZ9.p8" >&2
  exit 1
fi

# the Key ID is in the file name (AuthKey_<KeyID>.p8)
KEY_ID=$(basename "$P8" .p8)
KEY_ID=${KEY_ID#AuthKey_}
echo "Key ID: $KEY_ID"
read -r -p "Issuer ID (shown above the keys list in App Store Connect): " ISSUER

gh secret set APP_STORE_CONNECT_KEY_P8 --repo "$REPO" < "$P8"
printf %s "$KEY_ID" | gh secret set APP_STORE_CONNECT_KEY_ID --repo "$REPO"
printf %s "$ISSUER" | gh secret set APP_STORE_CONNECT_ISSUER_ID --repo "$REPO"

echo
echo "Done. Keep the .p8 file somewhere safe (Apple only lets you download it once), or delete it:"
echo "a new key can always be made. Secrets on GitHub now:"
gh secret list --repo "$REPO"
