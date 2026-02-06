function calculateAccountAge(ts){
  if(!ts) return "Gizli";
  const created=new Date(ts*1000);
  const now=new Date();
  return Math.floor((now-created)/(1000*60*60*24*365));
}

function calculateTrustScore(age,hours,kd,winrate,vac){
  let score=0

  if(age!=="Gizli") score+=age*2
  if(hours!=="Gizli") score+=hours/20
  if(kd!=="?") score+=kd*10
  if(winrate!=="?") score+=winrate/2
  if(vac>0) score-=40

  return Math.max(0,Math.min(100,Math.floor(score)))
}

function trustScore(age,hours,kd,winrate,vac){

  let score=0

  if(age!=="Gizli") score+=age*2
  if(hours!=="Gizli") score+=hours/20
  if(kd!=="?") score+=kd*10
  if(winrate!=="?") score+=winrate/2
  if(vac>0) score-=40

  return Math.max(0,Math.min(100,Math.floor(score)))
}

async function getFaceitBySteam(steamid){

  const res = await fetch(
    "https://open.faceit.com/data/v4/players?game=cs2&game_player_id=" + steamid,
    {
      headers:{
        "Authorization":"Bearer " + FACEIT_KEY
      }
    }
  )

  if(!res.ok) return null

  return await res.json()
}

async function getProfile(){

  let input = document.getElementById("steamid").value.trim()
if(!input) return

if(input.includes("steamcommunity.com")){
  try{
    const u = new URL(input)

    if(u.pathname.includes("/id/"))
      input = u.pathname.split("/id/")[1].split("/")[0]

    if(u.pathname.includes("/profiles/"))
      input = u.pathname.split("/profiles/")[1].split("/")[0]
  }catch{}
}

  const result=document.getElementById("result");
  result.innerHTML='<div class="loading">Yükleniyor...</div>';

  const res=await fetch(
    "https://steam-cs2-analytics.frudotz.workers.dev/?steamid="+encodeURIComponent(input)
  );

  const data=await res.json();

  if(data.error){
    result.innerHTML='<div class="error">'+data.error+'</div>';
    return;
  }

  const p=data.profile;
  const cs2=data.cs2;
  const bans=data.bans;
  const faceit=data.faceit;

  const faceitStats = data.faceitStats
const faceitHistory = data.faceitHistory
  
 let faceitLevel = null
let faceitBadgeURL = null

  let akHs=null, m4Hs=null, awpHs=null

if(faceitStats?.segments){
  const ak = faceitStats.segments.find(s=>s.label==="AK-47")
  const m4 = faceitStats.segments.find(s=>s.label==="M4A1")
  const awp = faceitStats.segments.find(s=>s.label==="AWP")

  if(ak) akHs = ak.stats["Headshots %"]
  if(m4) m4Hs = m4.stats["Headshots %"]
  if(awp) awpHs = awp.stats["Headshots %"]
}
  
if(faceit?.games?.cs2?.skill_level){
  faceitLevel = faceit.games.cs2.skill_level
  faceitBadgeURL = `https://faceitfinder.com/resources/ranks/skill_level_${faceitLevel}_lg.png`
}

  let winrate = "?"
if(faceitStats?.lifetime?.["Win Rate %"]){
  winrate = faceitStats.lifetime["Win Rate %"]
}

  let kd = "?"
let hs = "?"
let eloDiff = "?"

if(faceitStats?.lifetime){
  kd = faceitStats.lifetime["Average K/D Ratio"] || "?"
  hs = faceitStats.lifetime["Average Headshots %"] || "?"
}

if(faceitHistory?.items?.length){
  const last = faceitHistory.items[0]
  const diff = last.results?.elo_change
  if(typeof diff === "number"){
    eloDiff = diff > 0 ? `+${diff}` : `${diff}`
  }
}

let wlStrip = ""
if(faceitHistory?.items){
  faceitHistory.items.forEach(m=>{
    const win = m.results?.winner === m.team_id
    wlStrip += win
      ? `<span class="wl-win">W</span>`
      : `<span class="wl-loss">L</span>`
  })
}

  let mapStats = {}

if(faceitHistory?.items){
  faceitHistory.items.slice(0,10).forEach(m=>{
    const map = m.map || m.stats?.Map || "Bilinmeyen"
    mapStats[map] = (mapStats[map] || 0) + 1
  })
}

let mapListHTML = ""
Object.entries(mapStats).forEach(([map,count])=>{
  mapListHTML += `<div class="mini-stat">${map}<span>${count} maç</span></div>`
})
  
  const age=calculateAccountAge(p.timecreated);
  const hours=cs2?Math.floor(cs2.playtime_forever/60):"Gizli";
  const last2w=cs2?.playtime_2weeks
    ?Math.floor(cs2.playtime_2weeks/60):0;

  const trust=calculateTrustScore(age,hours,bans);

  const trustColor=
    trust>70?"#22c55e":
    trust>40?"#facc15":"#ef4444";

  let hoursEmoji = "🤙"
if(hours >= 2000) hoursEmoji = "🫡"
else if(hours >= 1000) hoursEmoji = "🚀"
else if(hours < 500) hoursEmoji = "😘"

const avgDaily = Math.round(last2w / 14)
const activeEmoji = avgDaily >= 5 ? "👌" : "⚡"

const vacIcon = bans.NumberOfVACBans > 0
  ? '<i class="fas fa-check ban-bad"></i>'
  : '<i class="fas fa-times ban-ok"></i>'

const gameBanIcon = bans.NumberOfGameBans > 0
  ? '<i class="fas fa-check ban-bad"></i>'
  : '<i class="fas fa-times ban-ok"></i>'

  result.innerHTML=`

<div class="card">
  <div class="profile-row">
    <div class="avatar">
      <img src="${p.avatarfull}">
    </div>
    <div>
      <div class="name">${p.personaname}</div>
      <div class="status-pill ${p.personastate===1?'status-online':'status-offline'}">
        ${p.personastate===1?'🟢 Online':'🔴 Offline'}
      </div>
      <div>Hesap Yaşı: ${age} yıl</div>
      <a href="${p.profileurl}" target="_blank">Profili Aç</a>
    </div>
<div class="faceit-rank-badge">
  <img src="${faceitBadgeURL}" alt="FACEIT Level ${faceitLevel}">
</div>
  </div>
</div>

<div class="card">
  <div>CS2 Bilgileri</div>
  <div class="grid-4">
    <div class="stat">
  ${hours} ${hoursEmoji}
  <span>Toplam Saat</span>
</div>

<div class="stat">
  ${last2w} ${activeEmoji}
  <span>Son 2 Hafta</span>
</div>

<div class="stat">
  ${vacIcon}
  <span>VAC Ban</span>
</div>

<div class="stat">
  ${gameBanIcon}
  <span>Game Ban</span>
</div>
  </div>
</div>

<div class="card">
  <div>Güven Skoru</div>

  <div class="trust-wrapper">

  <div class="trust-bar-outer">
    <div class="trust-bar-inner">

      <div 
        class="trust-bar-fill ${trust>70?'trust-good':trust>40?'trust-mid':'trust-bad'}"
        style="width:${trust}%"
      ></div>

      <div class="trust-text">
        ${trust} / 100
      </div>

    </div>
  </div>

</div>
</div>

<div class="card faceit-card">

  <div class="faceit-nick">
    ${faceit.nickname}
  </div>

  <div class="faceit-stats-row">

    <div class="faceit-col">
      <div class="faceit-big">${faceit.games.cs2.faceit_elo}</div>
      <span>ELO</span>
    </div>

    <div class="faceit-col">
      <div class="faceit-big">${winrate}%</div>
      <span>WinRate</span>
    </div>

    <div class="faceit-col">
      <div class="wl-strip">${wlStrip}</div>
      <span>W/L Oranı</span>
    </div>

  </div>

  <div class="faceit-substats">

    <div class="mini-stat">
      ${kd}
      <span>K/D</span>
    </div>

    <div class="mini-stat">
      ${hs}%
      <span>HS%</span>
    </div>

    <div class="mini-stat ${eloDiff.startsWith('+')?'elo-up':'elo-down'}">
      ${eloDiff}
      <span>Son Maç ELO</span>
    </div>

${akHs ? `<div class="mini-stat">${akHs}%<span>AK HS%</span></div>` : ``}
${m4Hs ? `<div class="mini-stat">${m4Hs}%<span>M4 HS%</span></div>` : ``}
${awpHs ? `<div class="mini-stat">${awpHs}%<span>AWP HS%</span></div>` : ``}
 ${mapListHTML}

  </div>

</div>
`};
