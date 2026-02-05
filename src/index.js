export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type"
    }

    try{

      const allowedDomains = [
      "cs2.frudotz.com",
      "frudotz.github.io"
    ]

    const origin = request.headers.get("Origin") || ""
    const referer = request.headers.get("Referer") || ""

    const isAllowed = allowedDomains.some(d =>
      origin.includes(d) || referer.includes(d)
    )

    if(!isAllowed){
      return new Response(
        JSON.stringify({ error:"Yetkisiz erişim" }),
        { status:403, headers:corsHeaders }
      )
    }

      const url = new URL(request.url)
      const steamid = url.searchParams.get("steamid")

      if(!steamid){
        return new Response(
          JSON.stringify({ error:"SteamID gerekli" }),
          { status:400, headers:corsHeaders }
        )
      }

      const STEAM_KEY = env.STEAM_KEY
      const FACEIT_KEY = env.FACEIT_KEY

      // STEAM PROFILE
      const profileRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_KEY}&steamids=${steamid}`
      )
      const profileData = await profileRes.json()
      const profile = profileData.response.players[0]

      // CS2 HOURS
      const gamesRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${steamid}&include_appinfo=true`
      )
      const gamesData = await gamesRes.json()
      const cs2 = gamesData.response.games?.find(g=>g.appid===730) || null

      // BANS
      const bansRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${STEAM_KEY}&steamids=${steamid}`
      )
      const bansData = await bansRes.json()
      const bans = bansData.players[0]

      // FACEIT
      let faceit = null
      const faceitRes = await fetch(
        `https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${steamid}`,
        {
          headers:{
            "Authorization":"Bearer "+FACEIT_KEY
          }
        }
      )

      if(faceitRes.ok){
        faceit = await faceitRes.json()
      }

      return new Response(
        JSON.stringify({ profile, cs2, bans, faceit }),
        { headers:corsHeaders }
      )

    }catch(e){

      return new Response(
        JSON.stringify({ error:"Sunucu hatası" }),
        { status:500, headers:corsHeaders }
      )

    }

  }
}
