export default {
  async fetch(request, env) {
    try {
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

      // 1️⃣ Profil verisi
      const profileRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_KEY}&steamids=${steamid}`
      )
      const profileData = await profileRes.json()

      // 2️⃣ Oyun listesi
      const gamesRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${steamid}&include_appinfo=true&include_free_games=true`
      )
      const gamesData = await gamesRes.json()

      // Güvenli erişim
      const games = gamesData?.response?.games || []

      const cs2 = games.find(g => g.appid === 730) || null

      // 3️⃣ Tek response
      return new Response(JSON.stringify({
        profile: profileData.response.players[0],
        cs2: cs2
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
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
