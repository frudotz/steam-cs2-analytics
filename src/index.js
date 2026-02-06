const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 20
const rateLimitStore = new Map()

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

      // ========== OWNED GAMES ==========
      const gamesRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${steamid}&include_appinfo=true`
      )

      const gamesData = await gamesRes.json()
      const gamesCount = gamesData.response?.game_count || 0

      let totalHours = 0
      let cs2 = null

      if (gamesData.response?.games) {
        for (const g of gamesData.response.games) {
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
        accountPower
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
