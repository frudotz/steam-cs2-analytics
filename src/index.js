const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 20
const rateLimitStore = new Map()
const STORE_CURRENCY = "USD"

function checkRateLimit(ip) {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS
    rateLimitStore.set(ip, { count: 1, resetAt })
    return { allowed: true, retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) }
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count += 1
  return { allowed: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
}

export default {
  async fetch(request, env) {

    const STEAM_KEY = env.STEAM_KEY
    const FACEIT_KEY = env.FACEIT_KEY
    const TURNSTILE_SECRET = env.TURNSTILE_SECRET

    const allowedOrigins = new Set([
      "https://cs2.frudotz.com",
      "https://frudotz.github.io"
    ])

    const origin = request.headers.get("Origin") || ""
    const isAllowedOrigin = allowedOrigins.has(origin)

    const corsHeaders = {
      "Access-Control-Allow-Origin": isAllowedOrigin ? origin : "",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Turnstile-Token",
      "Vary": "Origin"
    }

    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin) {
        return new Response("Origin not allowed", { status: 403 })
      }
      return new Response(null, { headers: corsHeaders })
    }

    if (!isAllowedOrigin) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        headers: corsHeaders,
        status: 403
      })
    }

    try {
      const ip = request.headers.get("cf-connecting-ip")
        || request.headers.get("x-forwarded-for")
        || "unknown"

      const rateLimitCheck = checkRateLimit(ip)
      if (!rateLimitCheck.allowed) {
        return new Response(JSON.stringify({
          error: "Rate limit exceeded",
          retryAfter: rateLimitCheck.retryAfter
        }), {
          headers: {
            ...corsHeaders,
            "Retry-After": `${rateLimitCheck.retryAfter}`
          },
          status: 429
        })
      }

      const url = new URL(request.url)
      let steamInput = url.searchParams.get("steamid")

      if (!steamInput) {
        return new Response(JSON.stringify({ error: "SteamID gerekli" }), {
          headers: corsHeaders,
          status: 400
        })
      }

      console.log("REQUEST", { ip, steamInput })

      const turnstileToken = request.headers.get("x-turnstile-token")
      if (!turnstileToken) {
        return new Response(JSON.stringify({ error: "Captcha gerekli" }), {
          headers: corsHeaders,
          status: 403
        })
      }

      if (!TURNSTILE_SECRET) {
        return new Response(JSON.stringify({ error: "Captcha konfigüre edilmedi" }), {
          headers: corsHeaders,
          status: 500
        })
      }

      const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: TURNSTILE_SECRET,
          response: turnstileToken,
          remoteip: ip
        })
      })

      const turnstileData = await turnstileRes.json()
      if (!turnstileData.success) {
        return new Response(JSON.stringify({ error: "Captcha doğrulaması başarısız" }), {
          headers: corsHeaders,
          status: 403
        })
      }

      // Steam profile linki geldiyse ayıkla
      if (steamInput.includes("steamcommunity.com")) {
        try {
          const u = new URL(steamInput)

          if (u.pathname.includes("/id/")) {
            steamInput = u.pathname.split("/id/")[1].split("/")[0]
          }

          if (u.pathname.includes("/profiles/")) {
            steamInput = u.pathname.split("/profiles/")[1].split("/")[0]
          }
        } catch {}
      }

      // Vanity URL -> SteamID64
      if (!/^\d{17}$/.test(steamInput)) {
        const vanityRes = await fetch(
          `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_KEY}&vanityurl=${steamInput}`
        )
        const vanityData = await vanityRes.json()

        if (vanityData.response.success !== 1) {
          return new Response(JSON.stringify({ error: "Steam kullanıcı bulunamadı" }), {
            headers: corsHeaders,
            status: 404
          })
        }

        steamInput = vanityData.response.steamid
      }

      const steamid = steamInput

      // ========== STEAM PROFIL ==========
      const profileRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_KEY}&steamids=${steamid}`
      )
      const profileData = await profileRes.json()
      const profile = profileData.response.players[0]
      if (!profile) {
        return new Response(JSON.stringify({ error: "Steam profili bulunamadı" }), {
          headers: corsHeaders,
          status: 404
        })
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
  let score = 0

  // Steam Level (20)
  if (steamLevel >= 50) score += 20
  else if (steamLevel >= 20) score += 14
  else if (steamLevel >= 10) score += 8

  // Hesap Yaşı (20)
  if (accountAge >= 10) score += 20
  else if (accountAge >= 5) score += 14
  else if (accountAge >= 2) score += 8

  // Oyun Sayısı (15)
  if (gamesCount >= 100) score += 15
  else if (gamesCount >= 30) score += 10
  else if (gamesCount >= 10) score += 5

  // Saat Dağılımı (15)
  if (totalHours >= 2000) score += 15
  else if (totalHours >= 500) score += 10
  else if (totalHours >= 100) score += 5

  // Rozet / Badge (10)
  if ((cs2BadgeCount || 0) > 0 || (topBadges?.length || 0) > 0) {
    score += 10
  }

  // Arkadaş sinyali (10)
  if (friendBanStats?.totalFriends >= 30) score += 10
  else if (friendBanStats?.totalFriends >= 10) score += 5

  // Topluluk bayrakları (10)
  if (
    workshopStats &&
    (workshopStats.likes > 0 || workshopStats.comments > 0)
  ) {
    score += 10
  } else if (profile.communityvisibilitystate === 3) {
    score += 5 // profil public
  }

  return Math.min(score, 100)
}

      const profileCompleteness = calculateProfileCompleteness({
  steamLevel,
  accountAge,
  gamesCount,
  totalHours,
  cs2BadgeCount: badgeData?.cs2BadgeCount,
  topBadges: badgeData?.topBadges,
  friendBanStats,
  workshopStats,
  profile
})

      
      
      // ========== OWNED GAMES ==========
      const gamesRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${steamid}&include_appinfo=true`
      )

      const gamesData = await gamesRes.json()
      const gamesCount = gamesData.response?.game_count || 0
      const gamesList = gamesData.response?.games || []

      let totalHours = 0
      let cs2 = null

      if (gamesList.length > 0) {
        for (const g of gamesList) {
          totalHours += g.playtime_forever
          if (g.appid === 730) cs2 = g
        }
      }

      totalHours = Math.floor(totalHours / 60)

      

      async function fetchSteamLevel(steamid, STEAM_KEY) {
  const res = await fetch(
    `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${STEAM_KEY}&steamid=${steamid}`
  )
  const data = await res.json()
  return data?.response?.player_level ?? null
}

      async function fetchBadges(steamid, STEAM_KEY) {
  try {
    const res = await fetch(
      `https://api.steampowered.com/IPlayerService/GetBadges/v1/?key=${STEAM_KEY}&steamid=${steamid}`
    )
    const data = await res.json()
    const badges = data?.response?.badges || []

    const cs2BadgeCount = badges.filter(b => b.appid === 730).length

    const topBadges = badges
      .sort((a, b) => (b.xp || 0) - (a.xp || 0))
      .slice(0, 3)
      .map(b => ({
        badgeid: b.badgeid,
        xp: b.xp || 0
      }))

    return {
      cs2BadgeCount,
      topBadges
    }
  } catch {
    return {
      cs2BadgeCount: null,
      topBadges: []
    }
  }
}

      async function fetchWorkshopStats(steamid) {
  try {
    const res = await fetch(
      `https://steamcommunity.com/profiles/${steamid}/myworkshopfiles/?xml=1`
    )
    const text = await res.text()

    const likes =
      Number(text.match(/<favorited>(\d+)<\/favorited>/)?.[1]) || 0
    const comments =
      Number(text.match(/<comments>(\d+)<\/comments>/)?.[1]) || 0

    return { likes, comments }
  } catch {
    return null
  }
}

      async function fetchFriendBanStats(steamid, STEAM_KEY) {
  try {
    const friendsRes = await fetch(
      `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${STEAM_KEY}&steamid=${steamid}`
    )
    const friendsData = await friendsRes.json()
    const friends = friendsData?.friendslist?.friends || []

    const sample = friends.slice(0, 50) // 🔥 limit
    if (sample.length === 0) return null

    const ids = sample.map(f => f.steamid).join(",")

    const bansRes = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${STEAM_KEY}&steamids=${ids}`
    )
    const bansData = await bansRes.json()

    const bannedFriends = bansData.players.filter(
      p => p.NumberOfVACBans > 0 || p.NumberOfGameBans > 0
    ).length

    return {
      bannedFriends,
      totalFriends: sample.length
    }
  } catch {
    return null
  }
}

      async function fetchAccountValue(gamesList = []) {
  try {
    let value = 0

    for (const g of gamesList) {
      if (g.playtime_forever > 0) value += 2
      if (g.playtime_forever > 600) value += 5
      if (g.playtime_forever > 2000) value += 10
    }

    return Math.round(value)
  } catch {
    return null
  }
}
      
      
      // ========== BANS ==========
      const banRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${STEAM_KEY}&steamids=${steamid}`
      )
      const banData = await banRes.json()
      const bans = banData.players[0]

      // ========== STEAM META ==========
      const steamLevel = await fetchSteamLevel(steamid, STEAM_KEY)
      const badgeData = await fetchBadges(steamid, STEAM_KEY)
      const workshopStats = await fetchWorkshopStats(steamid, STEAM_KEY)
      const friendBanStats = await fetchFriendBanStats(steamid, STEAM_KEY)
      const accountValue = await fetchAccountValue(gamesList)

      // ========== FACEIT ==========
      let faceit = null
      let faceitStats = null
      let faceitHistory = null

      try {
        const faceitUserRes = await fetch(
          `https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${steamid}`,
          { headers: { Authorization: `Bearer ${FACEIT_KEY}` } }
        )

        if (faceitUserRes.ok) {
          faceit = await faceitUserRes.json()

          const statsRes = await fetch(
            `https://open.faceit.com/data/v4/players/${faceit.player_id}/stats/cs2`,
            { headers: { Authorization: `Bearer ${FACEIT_KEY}` } }
          )
          faceitStats = await statsRes.json()

          const histRes = await fetch(
            `https://open.faceit.com/data/v4/players/${faceit.player_id}/history?game=cs2&limit=5`,
            { headers: { Authorization: `Bearer ${FACEIT_KEY}` } }
          )
          faceitHistory = await histRes.json()
        }
      } catch {}

      // ========== ACCOUNT POWER ==========
      const accountAge = profile.timecreated
        ? Math.floor((Date.now() - profile.timecreated * 1000) / (1000 * 60 * 60 * 24 * 365))
        : 0

      const accountPower =
        (gamesCount * 2) +
        (totalHours / 10) +
        (accountAge * 5)

      return new Response(JSON.stringify({
        profile,
        cs2,
        bans,
        faceit,
        faceitStats,
        faceitHistory,
        gamesCount,
        accountPower,
        steamLevel,
        accountValue,
        accountValueCurrency: STORE_CURRENCY,
        cs2BadgeCount: badgeData?.cs2BadgeCount ?? null,
        topBadges: badgeData?.topBadges ?? [],
        serviceYears: Number.isFinite(accountAge) ? accountAge : null,
        workshopStats,
        marketStats: null,
        tradeStats: null,
        friendBanStats,
        profileCompleteness
      }), {
        headers: corsHeaders
      })

    } catch (err) {

      console.error("WORKER ERROR:", err)

      return new Response(JSON.stringify({
        error: true,
        message: err.message || "Worker crash"
      }), {
        headers: corsHeaders,
        status: 500
      })
    }
  }
}
