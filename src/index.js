export default {
  async fetch(request, env) {
    try {

      const ALLOWED_ORIGINS = [
        "http://cs2.frudotz.com",
        "https://frudotz.github.io"
      ]

      const origin = request.headers.get("Origin")
      const referer = request.headers.get("Referer")

      const allowed = ALLOWED_ORIGINS.some(d =>
        origin?.startsWith(d) || referer?.startsWith(d)
      )

      if(!allowed){
        return new Response("Forbidden",{status:403})
      }

      globalThis.requests ??= new Map()
      const RATE_LIMIT = 30
      const ip = request.headers.get("CF-Connecting-IP") || "unknown"
      const now = Date.now()

      const record = globalThis.requests.get(ip) || {count:0,time:now}

      if(now-record.time < 60000){
        record.count++
        if(record.count > RATE_LIMIT){
          return new Response("Too Many Requests",{status:429})
        }
      }else{
        record.count=1
        record.time=now
      }

      globalThis.requests.set(ip,record)

      const url = new URL(request.url)
      const rawInput = url.searchParams.get("steamid")

      if(!rawInput){
        return new Response(
          JSON.stringify({error:"steamid parametresi gerekli"}),
          {status:400}
        )
      }

      function toSteamID64(input){

        input=input.trim()

        if(/^\d{17}$/.test(input)) return input

        const steam3 = input.match(/\[U:1:(\d+)\]/)
        if(steam3){
          return (BigInt("76561197960265728")+BigInt(steam3[1])).toString()
        }

        const steam2 = input.match(/STEAM_\d:(\d):(\d+)/)
        if(steam2){
          const Y=BigInt(steam2[1])
          const Z=BigInt(steam2[2])
          return (BigInt("76561197960265728")+Z*2n+Y).toString()
        }

        if(/^\d+$/.test(input)){
          return (BigInt("76561197960265728")+BigInt(input)).toString()
        }

        return null
      }

      let steamid = toSteamID64(rawInput)
      const STEAM_KEY = env.STEAM_KEY

      if(!steamid){

        const vanityRes = await fetch(
          `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_KEY}&vanityurl=${rawInput}`
        )
        const vanityData = await vanityRes.json()

        if(vanityData.response.success===1){
          steamid = vanityData.response.steamid
        }else{
          return new Response(
            JSON.stringify({error:"Geçersiz Steam kimliği"}),
            {status:400}
          )
        }
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
      const cs2 = games.find(g=>g.appid==730)||null

      const banRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${STEAM_KEY}&steamids=${steamid}`
      )
      const banData = await banRes.json()

      return new Response(JSON.stringify({
        steamid64: steamid,
        profile: profileData.response.players[0],
        cs2: cs2,
        bans: banData.players[0]
      }),{
        headers:{
          "Content-Type":"application/json",
          "Access-Control-Allow-Origin":origin||referer
        }
      })

    }catch(err){

      return new Response(
        JSON.stringify({error:err.toString()}),
        {status:500}
      )

    }
  }
}
