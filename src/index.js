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

      const apiUrl =
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_KEY}&steamids=${steamid}`

      const steamRes = await fetch(apiUrl)
      const data = await steamRes.json()

      return new Response(JSON.stringify(data, null, 2), {
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
