export default {
  async fetch(request, env) {
    try {

      const ALLOWED_ORIGIN = "https://cs2.frudotz.com"

      const origin = request.headers.get("Origin")
      const referer = request.headers.get("Referer")

      if (
        !origin?.startsWith(ALLOWED_ORIGIN) &&
        !referer?.startsWith(ALLOWED_ORIGIN)
      ) {
        return new Response("Forbidden", { status: 403 })
      }

      const RATE_LIMIT = 30
      globalThis.requests ??= new Map()

      const ip = request.headers.get("CF-Connecting-IP") || "unknown"
      const now = Date.now()

      const record = globalThis.requests.get(ip) || {
        count: 0,
        time: now
      }

      if (now - record.time < 60000) {
        record.count++
        if (record.count > RATE_LIMIT) {
          return new Response("Too Many Requests", { status: 429 })
        }
      } else {
        record.count = 1
        record.time = now
      }

      globalThis.requests.set(ip, record)

      const url = new URL(request.url)
      const steamid = url.searchParams.get("steamid")

      if (!steamid) {
        return new Response(
          JSON.stringify({ error: "steamid parametresi gerekli" }),
          { status: 400 }
        )
      }

      const STEAM_KEY = env.STEAM_KEY

      if (!STEAM_KEY) {
        return new Response(
          JSON.stringify({ error: "STEAM_KEY bulunamadı" }),
          { status: 500 }
        )
      }

      const profileRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_KEY}&steamids=${steamid}`
      )
      const profileData = await profileRes.json()

      const gamesRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${steamid}&include_appinfo=true&include_free_games=true`
      )
      const gamesData = await gamesRes.json()
      const games = gamesData?.response?.games || []
      const cs2 = games.find(g => g.appid == 730) || null

      const banRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${STEAM_KEY}&steamids=${steamid}`
      )
      const banData = await banRes.json()

      return new Response(JSON.stringify({
        profile: profileData.response.players[0],
        cs2: cs2,
        bans: banData.players[0]
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN
        }
      })

    } catch (err) {

      return new Response(
        JSON.stringify({ error: err.toString() }),
        { status: 500 }
      )

    }
  }
}
