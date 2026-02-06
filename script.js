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
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "")
  if(!path) return
  steamInput.value = decodeURIComponent(path)
  getProfile()
}

function calculateAge(ts){
  if(!ts) return "Gizli"
  return Math.floor((Date.now()-ts*1000)/(1000*60*60*24*365))
}

function calculateTrustScore(age,hours,winrate,vac,elo,power){
  let score=0

  if(age!=="Gizli") score+=age*1.2
  if(hours!=="Gizli") score+=hours/20
  if(winrate!=="?") score+=winrate*0.5
  if(elo) score+=elo/250
  if(power) score+=power/60
  if(vac>0) score-=50

  return Math.max(0,Math.min(100,Math.floor(score)))
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

  turnstileWrapper.classList.add("is-visible")
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
  turnstileWrapper.classList.remove("is-visible")

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
  const accountPower=data.accountPower

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

  const trust=calculateTrustScore(age,hours,winrate,bans.NumberOfVACBans,elo,accountPower)
  const trustLabel=trust>70?"Yüksek":trust>40?"Orta":"Düşük"
  const trustClass=trust>70?"trust-high":trust>40?"trust-mid":"trust-low"

  let faceitBadgeURL=null
  if(faceit?.games?.cs2?.skill_level){
    const lvl=faceit.games.cs2.skill_level
    faceitBadgeURL=`https://faceitfinder.com/resources/ranks/skill_level_${lvl}_lg.png`
  }

  result.innerHTML=`

<!-- STEAM PROFILE -->
<div class="card profile-card glow-card">

  <div class="profile-row">
    <img class="avatar" src="${p.avatarfull}">
    <div>
      <div class="name">${p.personaname}</div>

      <div class="status-pill ${p.personastate===1?'status-online':'status-offline'}">
        ${p.personastate===1?'🟢 Online':'🔴 Offline'}
      </div>

      <div class="sub">Hesap Yaşı: ${age} yıl</div>
      <a href="${p.profileurl}" target="_blank">Steam Profili</a>
    </div>
  </div>

  <div class="profile-badges">

    <div class="steam-games-badge">
      <img src="https://community.fastly.steamstatic.com/public/images/badges/13_gamecollector/250_80.png">
      <div class="badge-count">${gamesCount}</div>
    </div>

    ${faceitBadgeURL?`
    <div class="faceit-rank-badge">
      <img src="${faceitBadgeURL}">
    </div>`:""}

  </div>

</div>

<!-- CS2 -->
<div class="card glow-card">
  <div class="card-title">CS2</div>

  <div class="grid-4">

    <div class="stat">
      ${hours}
      <span>Toplam Saat</span>
    </div>

    <div class="stat">
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
`
}
