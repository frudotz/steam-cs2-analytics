<script>
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

  const totalHours = cs2 ? Math.floor(cs2.playtime_forever / 60) : "Gizli"
  const twoWeekHours = cs2?.playtime_2weeks 
      ? Math.floor(cs2.playtime_2weeks / 60) 
      : "0"

  const windowsHours = cs2 ? Math.floor(cs2.playtime_windows_forever / 60) : 0
  const linuxHours = cs2 ? Math.floor(cs2.playtime_linux_forever / 60) : 0
  const macHours = cs2 ? Math.floor(cs2.playtime_mac_forever / 60) : 0

  result.innerHTML = `
    <div class="card">

      <img class="avatar" src="${p.avatarfull}" />

      <div class="info">

        <div class="name">${p.personaname}</div>

        <div class="sub">${getStatus(p.personastate)}</div>

        <div class="sub">Gerçek Ad: ${p.realname || "Gizli"}</div>

        <div class="sub">Ülke: ${p.loccountrycode || "-"}</div>

        <div class="sub">Hesap Yaşı: ${calculateAccountAge(p.timecreated)} yıl</div>

        <hr>

        <div class="sub"><b>CS2 Toplam Süre:</b> ${totalHours} saat</div>

        <div class="sub">Son 2 Hafta: ${twoWeekHours} saat</div>

        <div class="sub">Son Oynama: ${unixToDate(cs2?.rtime_last_played)}</div>

        <div class="sub">Windows: ${windowsHours}h | Linux: ${linuxHours}h | Mac: ${macHours}h</div>

        <div class="sub">
          <a href="${p.profileurl}" target="_blank">Steam Profilini Aç</a>
        </div>

      </div>
    </div>
  `
}
</script>
