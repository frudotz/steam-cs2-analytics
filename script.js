function calculateAccountAge(timestamp){
  const created = new Date(timestamp * 1000)
  const now = new Date()
  return Math.floor((now - created) / (1000*60*60*24*365))
}

async function getProfile(){

  const steamid = document.getElementById("steamid").value
  const result = document.getElementById("result")

  result.innerHTML = "Yükleniyor..."

  const res = await fetch(
    "https://steam-cs2-analytics.frudotz.workers.dev/?steamid=" + steamid
  )

  const data = await res.json()
  const player = data.response.players[0]

  const age = calculateAccountAge(player.timecreated)

  result.innerHTML = `
    <div class="card">
      <img class="avatar" src="${player.avatarfull}" />
      <div class="info">
        <div class="name">${player.personaname}</div>
        <div class="sub">Hesap Yaşı: ${age} yıl</div>
        <div class="sub">SteamID: ${player.steamid}</div>
      </div>
    </div>
  `
}
