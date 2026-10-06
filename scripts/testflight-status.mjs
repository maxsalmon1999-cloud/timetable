// Read-only TestFlight check through the App Store Connect API: is each build processed, which tester groups have
// it, and who the testers are. Runs in the "TestFlight status" workflow (it needs the API key secrets).
//   APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_KEY_P8
import crypto from 'node:crypto'

const { APP_STORE_CONNECT_KEY_ID: kid, APP_STORE_CONNECT_ISSUER_ID: iss, APP_STORE_CONNECT_KEY_P8: p8 } = process.env
const BUNDLE_ID = 'com.maxsalmon.timetable'

const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url')
function token() {
  const now = Math.floor(Date.now() / 1000)
  const head = b64({ alg: 'ES256', kid, typ: 'JWT' })
  const body = b64({ iss, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: p8, dsaEncoding: 'ieee-p1363' })
  return `${head}.${body}.${sig.toString('base64url')}`
}
async function api(path) {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  const j = await r.json()
  if (!r.ok) throw new Error(`${path}: ${r.status} ${JSON.stringify(j.errors ?? j)}`)
  return j
}

const apps = await api(`apps?filter[bundleId]=${BUNDLE_ID}`)
const app = apps.data[0]
if (!app) throw new Error(`No app in App Store Connect with bundle ID ${BUNDLE_ID}`)
console.log(`App: ${app.attributes.name} (${app.id})\n`)

const builds = await api(`builds?filter[app]=${app.id}&sort=-uploadedDate&limit=10&include=buildBetaDetail,preReleaseVersion`)
console.log('Builds (newest first):')
for (const b of builds.data) {
  const a = b.attributes
  const detail = builds.included?.find((x) => x.type === 'buildBetaDetails' && x.id === b.relationships.buildBetaDetail?.data?.id)
  const ver = builds.included?.find((x) => x.type === 'preReleaseVersions' && x.id === b.relationships.preReleaseVersion?.data?.id)
  console.log(
    `  ${ver?.attributes.version ?? '?'} (${a.version})  uploaded ${a.uploadedDate}  processing=${a.processingState}  expired=${a.expired}` +
      `  usesNonExemptEncryption=${a.usesNonExemptEncryption}  internal=${detail?.attributes.internalBuildState}  external=${detail?.attributes.externalBuildState}`,
  )
}

const groups = await api(`apps/${app.id}/betaGroups?include=builds,betaTesters&limit=20`)
console.log('\nTester groups:')
if (!groups.data.length) console.log('  (none: create one under TestFlight → Internal Testing → +)')
for (const g of groups.data) {
  const a = g.attributes
  const ids = (rel) => (g.relationships[rel]?.data ?? []).map((d) => d.id)
  const buildNums = ids('builds').map((id) => builds.data.find((b) => b.id === id)?.attributes.version ?? id)
  const testers = ids('betaTesters').map((id) => {
    const t = groups.included?.find((x) => x.type === 'betaTesters' && x.id === id)?.attributes
    return t ? `${t.firstName ?? ''} ${t.lastName ?? ''} <${t.email ?? 'hidden'}> state=${t.state}` : id
  })
  console.log(`  ${a.name}  internal=${a.isInternalGroup}  autoDistribute=${a.hasAccessToAllBuilds}`)
  console.log(`    builds: ${buildNums.join(', ') || '(none)'}`)
  console.log(`    testers: ${testers.join('; ') || '(none)'}`)
}

const invites = await api(`userInvitations?limit=20`).catch((e) => ({ data: [], error: e.message }))
console.log('\nPending App Store Connect invitations:')
for (const i of invites.data) console.log(`  ${i.attributes.email}  roles=${i.attributes.roles}  expires=${i.attributes.expirationDate}`)
if (!invites.data.length) console.log(invites.error ? `  (couldn't read: ${invites.error})` : '  (none, so everyone invited has accepted)')
