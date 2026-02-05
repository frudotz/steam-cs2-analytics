function calculateAccountAge(timestamp){
  if(!timestamp) return "Gizli"
  const created = new Date(timestamp * 1000)
  const now = new Date()
  return Math.floor((now - created) / (1000*60*60*24*365))
}

function getStatus(state){
  return state === 1 ? "Online" : "Offline"
}

function getVisibility(v){
  return v === 3 ? "Public" : "Private"
}

async function getProfile(){

  const steamid = document.getElementById("steamid").value
  const result = document.getElementById("result")

  result.innerHTML = "Yükleniyor..."

  const res = await fetch(
    "https://steam-cs2-analytics.frudotz.workers.dev/?steamid=" + steamid
  )

  const data = await res.json()
  const p = data.response.players[0]

  result.innerHTML = `
    <div class="card">
      <img class="avatar" src="${p.avatarfull}" />

      <div class="info">
        <div class="name">${p.personaname}</div>
        <div class="sub">Hesap Yaşı: ${calculateAccountAge(p.timecreated)} yıl</div>
        <div class="sub">Durum: ${getStatus(p.personastate)}</div>
        <div class="sub">Profil: ${getVisibility(p.communityvisibilitystate)}</div>
        <div class="sub">
          <a href="${p.profileurl}" target="_blank">Steam Profilini Aç</a>
        </div>
      </div>
    </div>
  `
}
