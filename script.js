const API_URL = "https://steam-cs2-analytics.frudotz.workers.dev/"

const searchBtn = document.getElementById("searchBtn")
const steamInput = document.getElementById("steamid")
const turnstileWrapper = document.getElementById("turnstileWrapper")

searchBtn.addEventListener("click", getProfile)
steamInput.addEventListener("keydown", e=>{
  if(e.key==="Enter") getProfile()
})

setInitialSteamIdFromPath()

function setInitialSteamIdFromPath(){
  const path = window.location.pathname.replace(/^\/+|\/+$/g,"")
  if(!path) return
  steamInput.value = decodeURIComponent(path)
  getProfile()
}

/* =========================
   YARDIMCI FONKSİYONLAR
========================= */

function clamp(v,min,max){
  return Math.max(min,Math.min(max,v))
}

function normalize(value, cap){
  if(value === null || value === undefined) return null
  return clamp(value / cap, 0, 1)
}

function getNeutral(value){
  return value === null || value === undefined ? 0.5 : value
}

function calculateAge(ts){
  if(!ts) return "Gizli"
  return Math.floor((Date.now()-ts*1000)/(1000*60*60*24*365))
}

function formatNumber(v){
  if(v===null||v===undefined) return "Veri yok"
  return Intl.NumberFormat("tr-TR").format(v)
}

function formatCurrency(amount,currency="USD"){
  if(amount===null||amount===undefined) return "Veri yok"
  return Intl.NumberFormat("tr-TR",{
    style:"currency",
    currency,
    maximumFractionDigits:0
  }).format(amount)
}

/* =========================
   TRUST FAKTÖRLERİ
========================= */

function buildAgeActivityFactor(age,last2w){
  if(age===null||last2w===null) return null
  if(age<1 && last2w>30) return 0.7
  if(age>5 && last2w===0) return 0.3
  return 0.5
}

function buildBanFactor(bans){
  if(!bans) return null
  const vac=bans.NumberOfVACBans||0
  const game=bans.NumberOfGameBans||0
  const days=bans.DaysSinceLastBan??null

  if(vac>0||game>0){
    if(days!==null && days<365) return 0
    return 0.3
  }
  return 1
}

function buildFriendBanFactor(stats){
  if(!stats) return null
  return 1 - clamp(stats.bannedFriends/50,0,1)
}

function buildFaceitFactor(faceit,stats){
  if(!faceit||!stats?.lifetime) return null
  const winrate=parseInt(stats.lifetime["Win Rate %"]||0,10)
  const elo=faceit.games?.cs2?.faceit_elo||0
  const matches=parseInt(stats.lifetime["Matches"]||0,10)

  return clamp(
    (
      getNeutral(normalize(winrate,70)) +
      getNeutral(normalize(elo,2000)) +
      getNeutral(normalize(matches,500))
    )/3,
    0,1
  )
}

/* =========================
   TRUST SCORE
========================= */

function calculateTrustScore(p){
  const components=[
    {weight:0.15,value:normalize(p.ageYears,15)},
    {weight:0.15,value:normalize(p.totalHours,2000)},
    {weight:0.15,value:normalize(p.last2wHours,40)},
    {weight:0.08,value:normalize(p.steamLevel,100)},
    {weight:0.06,value:normalize(p.gamesCount,500)},
    {weight:0.05,value:normalize(p.accountValue,500)},
    {weight:0.05,value:normalize(p.cs2BadgeCount,10)},
    {weight:0.07,value:buildAgeActivityFactor(p.ageYears,p.last2wHours)},
    {weight:0.15,value:buildFaceitFactor(p.faceit,p.faceitStats)},
    {weight:0.20,value:buildBanFactor(p.bans)},
    {weight:0.04,value:buildFriendBanFactor(p.friendBanStats)},
    p.workshopStats ? {
      weight:0.03,
      value:normalize(
        (p.workshopStats.likes||0)+(p.workshopStats.comments||0),
        700
      )
    }:null
  ].filter(Boolean)

  const totalWeight=components.reduce((a,c)=>a+c.weight,0)

  const score=components.reduce(
    (acc,c)=>acc+(c.weight/totalWeight)*getNeutral(c.value),
    0
  )

  return Math.round(clamp(score*100,0,100))
}

/* =========================
   PROFİL ÇEKME (UI BOZULMADI)
========================= */

async function getProfile(){
  const result=document.getElementById("result")
  const input=steamInput.value.trim()
  if(!input) return

  result.innerHTML=`<div class="card loading-card">Analiz hazırlanıyor...</div>`

  const turnstileToken=document.querySelector("[name='cf-turnstile-response']")?.value
  if(!turnstileToken){
    result.innerHTML="Captcha gerekli"
    return
  }

  const res=await fetch(API_URL+"?steamid="+encodeURIComponent(input),{
    headers:{ "X-Turnstile-Token": turnstileToken }
  })

  const data=await res.json()
  if(window.turnstile) window.turnstile.reset()

  const p=data.profile
  const cs2=data.cs2

  const age=calculateAge(p.timecreated)
  const hours=cs2?Math.floor(cs2.playtime_forever/60):null
  const last2w=cs2?Math.floor((cs2.playtime_2weeks||0)/60):null

  const trust=calculateTrustScore({
    ageYears:age==="Gizli"?null:age,
    totalHours:hours,
    last2wHours:last2w,
    steamLevel:data.steamLevel,
    gamesCount:data.gamesCount,
    accountValue:data.accountValue,
    cs2BadgeCount:data.cs2BadgeCount,
    workshopStats:data.workshopStats,
    bans:data.bans,
    friendBanStats:data.friendBanStats,
    faceit:data.faceit,
    faceitStats:data.faceitStats
  })

  const trustLabel=trust>70?"Yüksek":trust>40?"Orta":"Düşük"

  result.innerHTML=`

<!-- STEAM PROFILE -->
<div class="card profile-card glow-card">

  <div class="profile-row">
    <img class="avatar" src="${p.avatarfull}">
    <div>
      <a class="name-link" href="${p.profileurl}" target="_blank" rel="noreferrer">
        <span class="name">${p.personaname}</span>
        <i class="fa-solid fa-arrow-up-right-from-square"></i>
      </a>

      <div class="status-pill ${p.personastate===1?'status-online':'status-offline'}">
        ${p.personastate===1?'🟢 Online':'🔴 Offline'}
      </div>

      <div class="sub">Hesap Yaşı: ${age} yıl</div>
      <div class="sub">Hesap Değeri: ${accountValue}</div>
    </div>
  </div>

  <div class="profile-badges">

    <div class="steam-games-badge">
      <img src="https://community.fastly.steamstatic.com/public/images/badges/13_gamecollector/250_80.png">
      <div class="badge-count">${gamesCount}</div>
    </div>

    <div class="badge-pill">
      <span>Seviye</span>
      <strong>${levelText}</strong>
    </div>

    <div class="badge-pill">
      <span>Hizmet</span>
      <strong>${serviceYearsText}</strong>
    </div>

    ${faceitBadgeURL?`
    <div class="faceit-rank-badge">
      <img src="${faceitBadgeURL}">
    </div>`:""}

  </div>

  <div class="badge-row">
    ${topBadgeMarkup}
  </div>

</div>

<!-- CS2 -->
<div class="card glow-card">
  <div class="card-title">CS2</div>

  <div class="grid-4">

    <div class="stat ${hours!=="Gizli"&&hours>500?"stat-positive":"stat-neutral"}">
      ${hours}
      <span>Toplam Saat</span>
    </div>

    <div class="stat ${last2w>40?"stat-positive":"stat-neutral"}">
      ${last2w}
      <span>Son 2 Hafta</span>
    </div>

    <div class="stat">
      ${bans.NumberOfVACBans>0?'<i class="fa-solid fa-check red"></i>':'<i class="fa-solid fa-xmark green"></i>'}
      <span>VAC Ban</span>
    </div>

    <div class="stat">
      ${bans.NumberOfGameBans>0?'<i class="fa-solid fa-check red"></i>':'<i class="fa-solid fa-xmark green"></i>'}
      <span>Game Ban</span>
    </div>

  </div>

  <div class="cs2-meta">
    <div>CS2 Rozet: ${cs2BadgeCount ?? "Veri yok"}</div>
    <div>Banlı Arkadaş: ${friendBanText}</div>
  </div>
</div>

<!-- FACEIT -->
<div class="card glow-card">
  <div class="card-title">FACEIT</div>

  ${faceit?`
  <div class="faceit-name">${faceit.nickname}</div>

  <div class="faceit-substats">
    <div class="mini-stat">${elo||"?"}<span>ELO</span></div>
    <div class="mini-stat">${winrate}%<span>Winrate</span></div>
    <div class="mini-stat">${wlStrip}<span>Son 5 Maç</span></div>
  </div>
  `:`Faceit profili yok`}

</div>

<!-- TRUST -->
<div class="card glow-card">
  <div class="card-title">Güven Skoru</div>

  <div class="trust-wrapper">
    <div class="trust-header">
      <span class="trust-score">${trust}/100</span>
      <span class="trust-label ${trustClass}">${trustLabel}</span>
    </div>
    <div class="trust-bar-bg">
      <div class="trust-bar-fill"
        style="width:${trust}%;">
      </div>
    </div>
  </div>

</div>

<!-- COMMUNITY -->
<div class="card glow-card">
  <div class="card-title">Topluluk Etkileşimi</div>
  <div class="grid-4">
    <div class="stat ${workshopStats?"stat-positive":"stat-neutral"}">
      ${formatNumber(workshopStats?.likes)}
      <span>Atölye Beğeni</span>
    </div>
    <div class="stat ${workshopStats?"stat-positive":"stat-neutral"}">
      ${formatNumber(workshopStats?.comments)}
      <span>Atölye Yorum</span>
    </div>
    <div class="stat ${marketStats?"stat-positive":"stat-neutral"}">
      ${formatNumber(marketStats?.transactions)}
      <span>Pazar İşlemi</span>
    </div>
    <div class="stat ${tradeStats?"stat-positive":"stat-neutral"}">
      ${formatNumber(tradeStats?.trades)}
      <span>Takas</span>
    </div>
  </div>
</div>
`
}

function loadTurnstileScript(){
  if(document.querySelector("script[data-turnstile]")) return
  const script=document.createElement("script")
  script.src="https://challenges.cloudflare.com/turnstile/v0/api.js"
  script.async=true
  script.defer=true
  script.dataset.turnstile="true"
  document.head.appendChild(script)
}
