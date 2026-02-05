function calculateAccountAge(timestamp){
  if(!timestamp) return "Gizli"
  const created = new Date(timestamp * 1000)
  const now = new Date()
  return Math.floor((now - created) / (1000*60*60*24*365))
}

function unixToDate(ts){
  return new Date(ts * 1000).toLocaleString("tr-TR")
}

function getStatus(state){
  return state === 1 ? "🟢 Online" : "⚫ Offline"
}

function calculateTrustScore(age, hours, bans){
  let score = 0

  if(typeof age === "number"){
    score += Math.min(age * 2, 30)
  }

  if(typeof hours === "number"){
    score += Math.min(hours / 10, 50)
  }

  if(bans.NumberOfVACBans === 0 && bans.NumberOfGameBans === 0){
    score += 20
  }

  return Math.floor(score)
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
  const bans = data.bans

  const totalHours = cs2 ? Math.floor(cs2.playtime_forever / 60) : "Gizli"
  const twoWeekHours = cs2?.playtime_2weeks 
      ? Math.floor(cs2.playtime_2weeks / 60) 
      : "0"

  const age = calculateAccountAge(p.timecreated)
  const trust = calculateTrustScore(age, totalHours, bans)

  result.innerHTML = `
    <div class="card">

      <img class="avatar" src="${p.avatarfull}" />

      <div class="info">

        <div class="name">${p.personaname}</div>

        <div class="sub">${getStatus(p.personastate)}</div>

        <div class="sub">Hesap Yaşı: ${age} yıl</div>

        <div class="sub">CS2 Süre: ${totalHours} saat</div>

        <div class="sub">Son 2 Hafta: ${twoWeekHours} saat</div>

        <div class="sub">VAC Ban: ${bans.NumberOfVACBans > 0 ? "Var" : "Yok"}</div>

        <div class="sub">Game Ban: ${bans.NumberOfGameBans > 0 ? "Var" : "Yok"}</div>

        <div class="sub">Güven Skoru: ${trust}/100</div>

        <div style="background:#1e293b;border-radius:8px;overflow:hidden;">
          <div style="
            width:${trust}%;
            background:${trust > 70 ? '#22c55e' : trust > 40 ? '#facc15' : '#ef4444'};
            height:10px;
          "></div>
        </div>

        <div class="sub">
          <a href="${p.profileurl}" target="_blank">Steam Profilini Aç</a>
        </div>

      </div>
    </div>
  `
}
