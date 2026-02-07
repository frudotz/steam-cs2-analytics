// ================== CORS ==================
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Turnstile-Token",
  "Content-Type": "application/json"
}

// ================== GLOBAL HELPERS ==================
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 20
const rateLimitStore = new Map()
const STORE_CURRENCY = "USD"

function checkRateLimit(ip) {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) return false

  entry.count++
  return true
}

// ================== STEAM HELPERS ==================
async function fetchSteamLevel(steamid, key) {
  const r = await fetch(
    `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${key}&steamid=${steamid}`
  )
  const j = await r.json()
  return j?.response?.player_level ?? null
}

async function fetchBadges(steamid, key) {
  const r = await fetch(
    `https://api.steampowered.com/IPlayerService/GetBadges/v1/?key=${key}&steamid=${steamid}`
  )
  const j = await r.json()
  const badges = j?.response?.badges || []

  return {
    cs2BadgeCount: badges.filter(b => b.appid === 730).length,
    topBadges: badges
      .sort((a, b) => (b.xp || 0) - (a.xp || 0))
      .slice(0, 3)
      .map(b => ({ badgeid: b.badgeid, xp: b.xp || 0 }))
  }
}

async function fetchWorkshopStats(steamid) {
  try {
    const r = await fetch(
      `https://steamcommunity.com/profiles/${steamid}/myworkshopfiles/?xml=1`
    )
    const t = await r.text()
    return {
      likes: Number(t.match(/<favorited>(\d+)<\/favorited>/)?.[1]) || 0,
      comments: Number(t.match(/<comments>(\d+)<\/comments>/)?.[1]) || 0
    }
  } catch {
    return null
  }
}

async function fetchFriendBanStats(steamid, key) {
  try {
    const fr = await fetch(
      `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${key}&steamid=${steamid}`
    )
    const fj = await fr.json()
    const friends = fj?.friendslist?.friends || []
    const sample = friends.slice(0, 50)
    if (!sample.length) return null

    const ids = sample.map(f => f.steamid).join(",")
    const br = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${key}&steamids=${ids}`
    )
    const bj = await br.json()

    return {
      bannedFriends: bj.players.filter(
        p => p.NumberOfVACBans > 0 || p.NumberOfGameBans > 0
      ).length,
      totalFriends: sample.length
    }
  } catch {
    return null
  }
}

async function fetchAccountValue(games = []) {
  let v = 0
  for (const g of games) {
    if (g.playtime_forever > 0) v += 2
    if (g.playtime_forever > 600) v += 5
    if (g.playtime_forever > 2000) v += 10
  }
  return v || null
}

function calculateProfileCompleteness({
  steamLevel,
  accountAge,
  gamesCount,
  totalHours,
  cs2BadgeCount,
  topBadges,
  friendBanStats,
  workshopStats,
  profile
}) {
  let s = 0

  if (steamLevel >= 50) s += 20
  else if (steamLevel >= 20) s += 14
  else if (steamLevel >= 10) s += 8

  if (accountAge >= 10) s += 20
  else if (accountAge >= 5) s += 14
  else if (accountAge >= 2) s += 8

  if (gamesCount >= 100) s += 15
  else if (gamesCount >= 30) s += 10
  else if (gamesCount >= 10) s += 5

  if (totalHours >= 2000) s += 15
  else if (totalHours >= 500) s += 10
  else if (totalHours >= 100) s += 5

  if ((cs2BadgeCount || 0) > 0 || topBadges?.length) s += 10
  if (friendBanStats?.totalFriends >= 10) s += 5
  if (friendBanStats?.totalFriends >= 30) s += 5

  if (workshopStats?.likes > 0 || workshopStats?.comments > 0) s += 10
  else if (profile.communityvisibilitystate === 3) s += 5

  return Math.min(s, 100)
}

// ================== WORKER ==================
export default {
  async fetch(request, env) {

    // ✅ CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS })
    }

    try {
      const ip =
        request.headers.get("cf-connecting-ip") ||
        request.headers.get("x-forwarded-for") ||
        "unknown"

      if (!checkRateLimit(ip)) {
        return new Response(
          JSON.stringify({ error: "Rate limit" }),
          { status: 429, headers: CORS_HEADERS }
        )
      }

      const turnstileToken = request.headers.get("x-turnstile-token")
      if (!turnstileToken) {
        return new Response(
          JSON.stringify({ error: "Captcha gerekli" }),
          { status: 403, headers: CORS_HEADERS }
        )
      }

      const verify = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: env.TURNSTILE_SECRET,
            response: turnstileToken,
            remoteip: ip
          })
        }
      )

      const vd = await verify.json()
      if (!vd.success) {
        return new Response(
          JSON.stringify({ error: "Captcha doğrulaması başarısız" }),
          { status: 403, headers: CORS_HEADERS }
        )
      }

      const url = new URL(request.url)
      let steamid = url.searchParams.get("steamid")
      if (!steamid) {
        return new Response(
          JSON.stringify({ error: "SteamID gerekli" }),
          { status: 400, headers: CORS_HEADERS }
        )
      }

      if (!/^\d{17}$/.test(steamid)) {
        const vr = await fetch(
          `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${env.STEAM_KEY}&vanityurl=${steamid}`
        )
        const vj = await vr.json()
        if (vj.response.success !== 1) {
          return new Response(
            JSON.stringify({ error: "Kullanıcı bulunamadı" }),
            { status: 404, headers: CORS_HEADERS }
          )
        }
        steamid = vj.response.steamid
      }

      const pr = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${env.STEAM_KEY}&steamids=${steamid}`
      )
      const profile = (await pr.json()).response.players[0]

      const gr = await fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${env.STEAM_KEY}&steamid=${steamid}&include_appinfo=true`
      )
      const gd = await gr.json()
      const games = gd.response?.games || []
      const gamesCount = gd.response?.game_count || 0
      const totalHours = Math.floor(
        games.reduce((a, g) => a + g.playtime_forever, 0) / 60
      )

      const steamLevel = await fetchSteamLevel(steamid, env.STEAM_KEY)
      const badgeData = await fetchBadges(steamid, env.STEAM_KEY)
      const workshopStats = await fetchWorkshopStats(steamid)
      const friendBanStats = await fetchFriendBanStats(steamid, env.STEAM_KEY)
      const accountValue = await fetchAccountValue(games)

      const accountAge = profile.timecreated
        ? Math.floor((Date.now() - profile.timecreated * 1000) / 31536000000)
        : 0

      const profileCompleteness = calculateProfileCompleteness({
        steamLevel,
        accountAge,
        gamesCount,
        totalHours,
        cs2BadgeCount: badgeData.cs2BadgeCount,
        topBadges: badgeData.topBadges,
        friendBanStats,
        workshopStats,
        profile
      })

      return new Response(
        JSON.stringify({
          profile,
          gamesCount,
          steamLevel,
          accountValue,
          accountValueCurrency: STORE_CURRENCY,
          cs2BadgeCount: badgeData.cs2BadgeCount,
          topBadges: badgeData.topBadges,
          workshopStats,
          friendBanStats,
          profileCompleteness
        }),
        { headers: CORS_HEADERS }
      )

    } catch (e) {
      return new Response(
        JSON.stringify({ error: true, message: e.message }),
        { status: 500, headers: CORS_HEADERS }
      )
    }
  }
}
