const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 20
const STORE_CURRENCY = "USD"
const PRICE_FETCH_CONCURRENCY = 5
const FRIENDS_BATCH_SIZE = 100
const rateLimitStore = new Map()

function chunkArray(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function fetchJson(url, options) {
  try {
    const res = await fetch(url, options)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function mapWithConcurrency(items, limit, asyncFn) {
  const results = new Array(items.length)
  let index = 0
  const workers = new Array(limit).fill(null).map(async () => {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await asyncFn(items[current], current)
    }
  })
  await Promise.all(workers)
  return results
}

async function fetchSteamLevel(steamid, key) {
  const data = await fetchJson(
    `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${key}&steamid=${steamid}`
  )
  return data?.response?.player_level ?? null
}

async function fetchBadges(steamid, key) {
  const data = await fetchJson(
    `https://api.steampowered.com/IPlayerService/GetBadges/v1/?key=${key}&steamid=${steamid}`
  )
  const badges = data?.response?.badges || []
  const cs2BadgeCount = badges.filter(badge => badge.appid === 730).length
  const topBadges = [...badges]
    .filter(badge => typeof badge.xp === "number")
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 3)
    .map(badge => ({
      badgeid: badge.badgeid,
      level: badge.level,
      xp: badge.xp,
      appid: badge.appid
    }))

  return { badges, cs2BadgeCount, topBadges }
}

async function fetchWorkshopStats(steamid, key) {
  const body = new URLSearchParams({
    key,
    steamid,
    appid: "730",
    numperpage: "100",
    return_metadata: "1",
    return_total_only: "0",
    filetype: "0"
  })

  const data = await fetchJson(
    "https://api.steampowered.com/IPublishedFileService/GetUserFiles/v1/",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    }
  )

  const files = data?.response?.publishedfiledetails
    || data?.response?.publishedfileids
    || data?.response?.files
    || []

  if (!Array.isArray(files) || files.length === 0) return null

  let likes = 0
  let comments = 0
  for (const file of files) {
    likes += Number(file.votes_up || 0)
    comments += Number(file.num_comments_public || file.num_comments || 0)
  }

  return { likes, comments, items: files.length }
}

async function fetchFriendBanStats(steamid, key) {
  const friendsData = await fetchJson(
    `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${key}&steamid=${steamid}&relationship=friend`
  )

  const friends = friendsData?.friendslist?.friends
  if (!Array.isArray(friends) || friends.length === 0) return null

  const friendIds = friends.map(friend => friend.steamid)
  const batches = chunkArray(friendIds, FRIENDS_BATCH_SIZE)
  let bannedFriends = 0

  for (const batch of batches) {
    const bansData = await fetchJson(
      `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${key}&steamids=${batch.join(",")}`
    )
    const players = bansData?.players || []
    for (const player of players) {
      if ((player.NumberOfVACBans || 0) > 0 || (player.NumberOfGameBans || 0) > 0) {
        bannedFriends += 1
      }
    }
  }

  return { totalFriends: friendIds.length, bannedFriends }
}

async function fetchAccountValue(games) {
  if (!Array.isArray(games) || games.length === 0) return null

  const values = await mapWithConcurrency(games, PRICE_FETCH_CONCURRENCY, async (game) => {
    const data = await fetchJson(
      `https://store.steampowered.com/api/appdetails?appids=${game.appid}&cc=us&l=en`
    )
    const appData = data?.[game.appid]?.data
    if (!appData || appData.is_free) return 0
    const price = appData.price_overview?.final
    if (!price) return 0
    return price / 100
  })

  const total = values.reduce((acc, value) => acc + (value || 0), 0)
  return total
}

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

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Turnstile-Token"
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders })
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
        friendBanStats
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
