const API_URL = "https://steam-cs2-analytics.frudotz.workers.dev/"

const searchBtn = document.getElementById("searchBtn")
const steamInput = document.getElementById("steamid")
<<<<<<< codex/implement-security-and-design-updates-38haba
const turnstileWrapper = document.getElementById("turnstileWrapper")
=======
>>>>>>> main

searchBtn.addEventListener("click", getProfile)
steamInput.addEventListener("keydown", e=>{
  if(e.key==="Enter") getProfile()
})

setInitialSteamIdFromPath()

function setInitialSteamIdFromPath(){
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "")
  if(!path) return
  steamInput.value = decodeURIComponent(path)
  getProfile()
}

function calculateAge(ts){
  if(!ts) return "Gizli"
  return Math.floor((Date.now()-ts*1000)/(1000*60*60*24*365))
}

function clamp(value,min,max){
  return Math.max(min,Math.min(max,value))
}

function normalize(value,cap){
  if(value===null||value===undefined) return null
  return clamp(value/cap,0,1)
}

function formatNumber(value){
  if(value===null||value===undefined) return "Veri yok"
  return Intl.NumberFormat("tr-TR").format(value)
}

function formatCurrency(amount,currency="USD"){
  if(amount===null||amount===undefined) return "Veri yok"
  return new Intl.NumberFormat("tr-TR",{
    style:"currency",
    currency,
    maximumFractionDigits:0
  }).format(amount)
}

function getNeutralFactor(value){
  return value===null||value===undefined ? 0.5 : value
}

function calculateTrustScore(payload){
  const {
    ageYears,
    totalHours,
    steamLevel,
    gamesCount,
    accountValue,
    workshopStats,
    marketStats,
    tradeStats,
    cs2BadgeCount,
    bans,
    friendBanStats,
    faceitStats,
    faceit
  } = payload

  const components = [
    { weight:0.12, value:getNeutralFactor(normalize(ageYears,15)) },
    { weight:0.12, value:getNeutralFactor(normalize(totalHours,2000)) },
    { weight:0.1, value:getNeutralFactor(normalize(steamLevel,100)) },
    { weight:0.08, value:getNeutralFactor(normalize(accountValue,500)) },
    { weight:0.06, value:getNeutralFactor(normalize(gamesCount,500)) },
    {
      weight:0.06,
      value:getNeutralFactor(normalize((workshopStats?.likes||0)+(workshopStats?.comments||0),700))
    },
    {
      weight:0.06,
      value:getNeutralFactor(normalize((marketStats?.transactions||0)+(tradeStats?.trades||0),200))
    },
    { weight:0.06, value:getNeutralFactor(normalize(cs2BadgeCount,10)) },
    { weight:0.12, value:getNeutralFactor(buildFaceitFactor(faceit,faceitStats)) },
    { weight:0.15, value:getNeutralFactor(buildBanFactor(bans)) },
    { weight:0.07, value:getNeutralFactor(buildFriendBanFactor(friendBanStats)) }
  ]

  const score = components.reduce((acc,item)=>acc+(item.weight*item.value),0)
  return Math.round(clamp(score*100,0,100))
}

function buildFaceitFactor(faceit,faceitStats){
  if(!faceit || !faceitStats?.lifetime) return null
  const winrate = parseInt(faceitStats.lifetime["Win Rate %"] || 0,10)
  const elo = faceit?.games?.cs2?.faceit_elo || 0
  const matches = parseInt(faceitStats.lifetime["Matches"] || 0,10)
  const winFactor = normalize(winrate,70) ?? 0.5
  const eloFactor = normalize(elo,2000) ?? 0.5
  const matchFactor = normalize(matches,500) ?? 0.5
  return clamp((winFactor+eloFactor+matchFactor)/3,0,1)
}

function buildFriendBanFactor(friendBanStats){
  if(!friendBanStats) return null
  const banned = friendBanStats.bannedFriends || 0
  return 1 - clamp(banned/50,0,1)
}

function buildBanFactor(bans){
  if(!bans) return null
  const vac = bans.NumberOfVACBans || 0
  const game = bans.NumberOfGameBans || 0
  return vac>0 || game>0 ? 0 : 1
}

async function getProfile(){

  let input=steamInput.value.trim()
  if(!input) return

  const result=document.getElementById("result")
  result.innerHTML=`
    <div class="card loading-card">
      <div class="loader"></div>
      <div>Analiz hazırlanıyor...</div>
    </div>
  `

<<<<<<< codex/implement-security-and-design-updates-38haba
  turnstileWrapper.classList.add("is-visible")
=======
>>>>>>> main
  const turnstileToken = document.querySelector("[name='cf-turnstile-response']")?.value

  if(!turnstileToken){
    result.innerHTML="Lütfen captcha doğrulamasını tamamla."
    return
  }

  const res=await fetch(API_URL+"?steamid="+encodeURIComponent(input), {
    headers: {
      "X-Turnstile-Token": turnstileToken
    }
  })

  if(!res.ok){
    const errorText = await res.text()
    result.innerHTML=`Sunucu hatası: ${errorText}`
    return
  }
  const data=await res.json()

  if(window.turnstile){
    window.turnstile.reset()
  }
<<<<<<< codex/implement-security-and-design-updates-38haba
  turnstileWrapper.classList.remove("is-visible")
=======
>>>>>>> main

  if(data.error){
    result.innerHTML="Kullanıcı bulunamadı."
    return
  }

  const p=data.profile
  const cs2=data.cs2
  const bans=data.bans
  const faceit=data.faceit
  const faceitStats=data.faceitStats
  const faceitHistory=data.faceitHistory
  const gamesCount=data.gamesCount
  const steamLevel=data.steamLevel
  const accountValue=data.accountValue
  const accountValueCurrency=data.accountValueCurrency
  const cs2BadgeCount=data.cs2BadgeCount
  const serviceYears=data.serviceYears
  const topBadges=data.topBadges || []
  const workshopStats=data.workshopStats
  const marketStats=data.marketStats
  const tradeStats=data.tradeStats
  const friendBanStats=data.friendBanStats

  const age=calculateAge(p.timecreated)
  const hours=cs2?Math.floor(cs2.playtime_forever/60):"Gizli"
  const last2w=cs2?Math.floor((cs2.playtime_2weeks||0)/60):0

  let winrate="?"
  let elo=null
  if(faceitStats?.lifetime?.["Win Rate %"])
    winrate=parseInt(faceitStats.lifetime["Win Rate %"])

  if(faceit?.games?.cs2?.faceit_elo)
    elo=faceit.games.cs2.faceit_elo

  let wlStrip="-----"
  if(faceitHistory?.items){
    wlStrip=faceitHistory.items
      .slice(0,5)
      .map(m=>m.results.winner===faceit.player_id?"W":"L")
      .join(" ")
  }

<<<<<<< codex/implement-security-and-design-updates-38haba
  const vacBans=bans?.NumberOfVACBans ?? null
  const gameBans=bans?.NumberOfGameBans ?? null

  const trust=calculateTrustScore({
    ageYears: age==="Gizli"?null:age,
    totalHours: hours==="Gizli"?null:hours,
    steamLevel,
    gamesCount,
    accountValue,
    workshopStats,
    marketStats,
    tradeStats,
    cs2BadgeCount,
    bans,
    friendBanStats,
    faceitStats,
    faceit
  })
=======
  const trust=calculateTrustScore(age,hours,winrate,bans.NumberOfVACBans,elo,accountPower)
>>>>>>> main
  const trustLabel=trust>70?"Yüksek":trust>40?"Orta":"Düşük"
  const trustClass=trust>70?"trust-high":trust>40?"trust-mid":"trust-low"

  let faceitBadgeURL=null
  if(faceit?.games?.cs2?.skill_level){
    const lvl=faceit.games.cs2.skill_level
    faceitBadgeURL=`https://faceitfinder.com/resources/ranks/skill_level_${lvl}_lg.png`
  }

  const accountValueText=formatCurrency(accountValue,accountValueCurrency)
  const serviceYearsText=(serviceYears===null||serviceYears===undefined) ? "Veri yok" : `${serviceYears} yıl`
  const levelText=steamLevel??"Veri yok"
  const friendBanText=friendBanStats
    ? `${friendBanStats.bannedFriends}/${friendBanStats.totalFriends}`
    : "Veri yok"
  const topBadgeMarkup=topBadges.length
    ? topBadges.map(badge=>`
      <div class="mini-badge">
        <span>XP ${formatNumber(badge.xp)}</span>
        <small>Badge #${badge.badgeid}</small>
      </div>
    `).join("")
    : `<div class="mini-badge empty">Veri yok</div>`

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
      <div class="sub">Hesap Değeri: ${accountValueText}</div>
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

<<<<<<< codex/implement-security-and-design-updates-38haba
    <div class="stat ${vacBans===null?"stat-neutral":vacBans>0?"stat-negative":"stat-positive"}">
      ${vacBans===null?'<span>Veri yok</span>':vacBans>0?'<i class="fa-solid fa-check red"></i>':'<i class="fa-solid fa-xmark green"></i>'}
      <span>VAC Ban</span>
    </div>

    <div class="stat ${gameBans===null?"stat-neutral":gameBans>0?"stat-negative":"stat-positive"}">
      ${gameBans===null?'<span>Veri yok</span>':gameBans>0?'<i class="fa-solid fa-check red"></i>':'<i class="fa-solid fa-xmark green"></i>'}
=======
    <div class="stat">
      ${bans.NumberOfVACBans>0?'<i class="fa-solid fa-check red"></i>':'<i class="fa-solid fa-xmark green"></i>'}
      <span>VAC Ban</span>
    </div>

    <div class="stat">
      ${bans.NumberOfGameBans>0?'<i class="fa-solid fa-check red"></i>':'<i class="fa-solid fa-xmark green"></i>'}
>>>>>>> main
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
`
}
