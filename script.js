function calculateAccountAge(ts){
  if(!ts) return "Gizli"
  const created = new Date(ts*1000)
  const now = new Date()
  return Math.floor((now-created)/(1000*60*60*24*365))
}

function getStatus(s){
  return s===1?"🟢 Online":"⚫ Offline"
}

function calculateTrustScore(age, hours, bans){
  let score = 0

  if(typeof age==="number"){
    score += Math.min(age*2,30)
  }

  if(typeof hours==="number"){
    score += Math.min(hours/10,50)
  }

  if(bans.NumberOfVACBans===0 && bans.NumberOfGameBans===0){
    score += 20
  }else{
    score = Math.min(score,40)
  }

  return Math.floor(score)
}

async function getProfile(){

  const steamid = document.getElementById("steamid").value
  const result = document.getElementById("result")

  result.innerHTML="Yükleniyor..."

  const res = await fetch(
   "https://steam-cs2-analytics.frudotz.workers.dev/?steamid="+steamid
  )

  const data = await res.json()

  const p = data.profile
  const cs2 = data.cs2
  const bans = data.bans

  const age = calculateAccountAge(p.timecreated)
  const hours = cs2 ? Math.floor(cs2.playtime_forever/60) : "Gizli"
  const last2w = cs2?.playtime_2weeks
    ? Math.floor(cs2.playtime_2weeks/60)
    : 0

  const trust = calculateTrustScore(age,hours,bans)

  const trustColor =
    trust>70 ? "#22c55e" :
    trust>40 ? "#facc15" :
    "#ef4444"

  result.innerHTML = `

  <!-- STEAM PROFIL -->
  <div class="card section">
    <div class="card-title">Steam Profil</div>
    <div style="display:flex;gap:15px;align-items:center;">
      <img class="avatar" src="${p.avatarfull}">
      <div>
        <div class="name">${p.personaname}</div>
        <div class="sub">${getStatus(p.personastate)}</div>
        <div class="sub">Hesap Yaşı: ${age} yıl</div>
        <div class="sub">
          <a href="${p.profileurl}" target="_blank">Profili Aç</a>
        </div>
      </div>
    </div>
  </div>

  <!-- CS2 -->
  <div class="card section">
    <div class="card-title">CS2 Bilgileri</div>
    <div class="sub">Toplam Süre: ${hours} saat</div>
    <div class="sub">Son 2 Hafta: ${last2w} saat</div>
    <div class="sub">VAC Ban: ${bans.NumberOfVACBans>0?"Var":"Yok"}</div>
    <div class="sub">Game Ban: ${bans.NumberOfGameBans>0?"Var":"Yok"}</div>
  </div>

  <!-- GÜVEN -->
  <div class="card section">
    <div class="card-title">Güven Skoru</div>
    <div class="sub">${trust}/100</div>
    <div class="bar-bg">
      <div class="bar-fill" style="width:${trust}%;background:${trustColor}"></div>
    </div>
  </div>

  `
}
