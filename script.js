function calculateAccountAge(timestamp){
  if(!timestamp) return "Gizli"
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

  const p = data.profile
  const cs2 = data.cs2

  const hours = cs2 
    ? Math.floor(cs2.playtime_forever / 60) 
    : "Bulunamadı"

  const age = calculateAccountAge(p.timecreated)

  result.innerHTML = `
    <div class="card">
      <img class="avatar" src="${p.avatarfull}" />
      <div class="info">
        <div class="name">${p.personaname}</div>
        <div class="sub">Hesap Yaşı: ${age} yıl</div>
        <div class="sub">CS2 Süre: ${hours} saat</div>
        <div class="sub">
          <a href="${p.profileurl}" target="_blank">Steam Profilini Aç</a>
        </div>
      </div>
    </div>
  `
}
