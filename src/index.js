export default {
  async fetch(request, env) {

    const STEAM_KEY = env.STEAM_KEY
    const FACEIT_KEY = env.FACEIT_KEY

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type"
    }

    try {

      const url = new URL(request.url)
      let steamInput = url.searchParams.get("steamid")

      if (!steamInput) {
        return new Response(JSON.stringify({ error: "SteamID gerekli" }), {
          headers: corsHeaders,
          status: 400
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
