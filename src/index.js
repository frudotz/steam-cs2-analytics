export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type"
    }

    try {

      const url = new URL(request.url)
      let input = url.searchParams.get("steamid")

      if(!input){
        return new Response(
          JSON.stringify({ error:"SteamID gerekli" }),
          { status:400, headers:corsHeaders }
        )
      }

      const STEAM_KEY = env.STEAM_KEY
      const FACEIT_KEY = env.FACEIT_KEY

      let steamid = input

      // VANITY → STEAMID64
      if(!/^\d{17}$/.test(input)){

        const vanityURL =
          `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_KEY}&vanityurl=${input}`

        const vanityRes = await fetch(vanityURL)

        if(!vanityRes.ok){
          return new Response(
            JSON.stringify({ error:"Vanity API isteği başarısız" }),
            { status:500, headers:corsHeaders }
          )
        }

        const vanityData = await vanityRes.json()

        if(vanityData.response?.success !== 1){
          return new Response(
            JSON.stringify({ error:"Steam kullanıcısı bulunamadı" }),
            { status:404, headers:corsHeaders }
          )
        }

        steamid = vanityData.response.steamid
      }

      // PROFILE
      const profileRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_KEY}&steamids=${steamid}`
      )

      if(!profileRes.ok){
        return new Response(
          JSON.stringify({ error:"Steam profil API hata" }),
          { status:500, headers:corsHeaders }
        )
      }

      const profileData = await profileRes.json()
      const profile = profileData.response.players[0]

      // OWNED GAMES
      const gamesRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${steamid}&include_appinfo=true`
      )

      const gamesData = await gamesRes.json()
      const cs2 = gamesData.response?.games?.find(g=>g.appid===730) || null

      // BANS
      const bansRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${STEAM_KEY}&steamids=${steamid}`
      )

      const bansData = await bansRes.json()
      const bans = bansData.players[0]

      // FACEIT
      let faceit=null
      const faceitRes = await fetch(
        `https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${steamid}`,
        {
          headers:{ Authorization:"Bearer "+FACEIT_KEY }
        }
      )

      if(faceitRes.ok){
        faceit=await faceitRes.json()
      }

const calcRes = await fetch(
  `https://steamdb.info/calculator/${steamid}/`,
  { headers:{ "User-Agent":"Mozilla/5.0" } }
)

let accountValue = null

if(calcRes.ok){
  const html = await calcRes.text()
  const match = html.match(/\$([0-9,]+)/)
  if(match) accountValue = match[1]
}
      
      // FACEIT STATS
let faceitStats = null
let faceitHistory = null

if(faceit?.player_id){

  const statsRes = await fetch(
    `https://open.faceit.com/data/v4/players/${faceit.player_id}/stats/cs2`,
    { headers:{ Authorization:"Bearer "+FACEIT_KEY } }
  )

  if(statsRes.ok){
    faceitStats = await statsRes.json()
  }

  const historyRes = await fetch(
    `https://open.faceit.com/data/v4/players/${faceit.player_id}/history?game=cs2&limit=5`,
    { headers:{ Authorization:"Bearer "+FACEIT_KEY } }
  )

  if(historyRes.ok){
    faceitHistory = await historyRes.json()
  }
}
      
     return new Response(
  JSON.stringify({
    profile,
    cs2,
    bans,
    faceit,
    faceitStats,
    faceitHistory,
    accountValue
  }),
  { headers: corsHeaders }
)

    }catch(err){

      return new Response(
        JSON.stringify({ error:"Worker crash", detail:String(err) }),
        { status:500, headers:corsHeaders }
      )

    }

  }
}
