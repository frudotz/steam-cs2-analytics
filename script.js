const API_URL = "https://steam-cs2-analytics.frudotz.workers.dev/"

const searchBtn = document.getElementById("searchBtn")
const steamInput = document.getElementById("steamid")

// === UI refs (mevcut tasarımına göre) ===
const avatarEl = document.getElementById("profileAvatar")
const nameEl = document.getElementById("profileName")
const steamLevelEl = document.getElementById("profileSteamLevel")

const completenessValueEl = document.getElementById("profileCompletenessValue")
const completenessBarEl = document.getElementById("profileCompletenessBar")
const completenessLabelEl = document.getElementById("profileCompletenessLabel")

let currentTurnstileToken = null
window.onTurnstileSuccess = token => (currentTurnstileToken = token)

searchBtn.onclick = getProfile
steamInput.onkeydown = e => e.key === "Enter" && getProfile()

async function getProfile() {
  const input = steamInput.value.trim()
  if (!input) return

  if (!currentTurnstileToken) {
    alert("Lütfen captcha doğrulamasını tamamla.")
    return
  }

  searchBtn.disabled = true
  searchBtn.textContent = "Yükleniyor…"

  let res
  try {
    res = await fetch(API_URL + "?steamid=" + encodeURIComponent(input), {
      headers: {
        "X-Turnstile-Token": currentTurnstileToken
      }
    })
  } catch {
    alert("Sunucuya bağlanılamadı.")
    resetTurnstile()
    return
  }

  resetTurnstile()
  searchBtn.disabled = false
  searchBtn.textContent = "Getir"

  if (!res.ok) {
    alert("Sunucu hatası")
    return
  }

  const data = await res.json()

  // === PROFIL KARTI ===
  avatarEl.src = data.profile.avatarfull
  nameEl.textContent = data.profile.personaname
  steamLevelEl.textContent = `Steam Level: ${data.steamLevel ?? "?"}`

  // === PROFIL DOLULUĞU ===
  const pc = data.profileCompleteness ?? 0

  completenessValueEl.textContent = `${pc}/100`
  completenessBarEl.style.width = `${pc}%`

  if (pc > 70) {
    completenessLabelEl.textContent = "DOLU"
    completenessLabelEl.className = "badge badge-success"
  } else if (pc > 40) {
    completenessLabelEl.textContent = "ORTA"
    completenessLabelEl.className = "badge badge-warning"
  } else {
    completenessLabelEl.textContent = "ZAYIF"
    completenessLabelEl.className = "badge badge-danger"
  }
}

function resetTurnstile() {
  currentTurnstileToken = null
  window.turnstile?.reset()
}
