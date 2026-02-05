export default {
  async fetch(request) {
    const url = new URL(request.url)
    const steamid = url.searchParams.get("steamid")

    if (!steamid) {
      return new Response(
        JSON.stringify({ error: "steamid parametresi gerekli" }),
        { status: 400 }
      )
    }

    const STEAM_KEY = process.env.STEAM_KEY;

    const steamRes = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_KEY}&steamids=${steamid}`
    )

    const data = await steamRes.json()

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    })
  }
}
