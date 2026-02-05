function calculateAccountAge(ts){
  if(!ts) return "Gizli";
  const created=new Date(ts*1000);
  const now=new Date();
  return Math.floor((now-created)/(1000*60*60*24*365));
}

function calculateTrustScore(age,hours,bans){
  let score=0;
  if(typeof age==="number") score+=Math.min(age*2,30);
  if(typeof hours==="number") score+=Math.min(hours/10,50);
  if(bans.NumberOfVACBans===0 && bans.NumberOfGameBans===0){
    score+=20;
  }else{
    score=Math.min(score,40);
  }
  return Math.floor(score);
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

  let faceitLevel = null
let faceitClass = ""

if(faceit?.games?.cs2?.skill_level){
  faceitLevel = faceit.games.cs2.skill_level

  if(faceitLevel <= 3) faceitClass = "faceit-low"
  else if(faceitLevel <= 6) faceitClass = "faceit-mid"
  else if(faceitLevel <= 9) faceitClass = "faceit-high"
  else faceitClass = "faceit-pro"
}

  
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
<div class="faceit-badge ${faceitClass}">
  ${faceitLevel}
  <span>FACEIT</span>
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

<div class="card">
<b>FACEIT</b><br>
Nick: ${faceit.nickname}<br>
Level: ${faceit.games.cs2.skill_level}<br>
ELO: ${faceit.games.cs2.faceit_elo}
</div>
`};
