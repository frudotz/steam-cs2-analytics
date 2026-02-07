// ================== CONFIG ==================
const API_URL = "https://steam-cs2-analytics.frudotz.workers.dev/"

// ================== ELEMENTS ==================
const searchBtn = document.getElementById("searchBtn")
const steamInput = document.getElementById("steamid")
const result = document.getElementById("result")

// ================== TURNSTILE ==================
let currentTurnstileToken = null

window.onTurnstileSuccess = function (token) {
  currentTurnstileToken = token
}

// ================== EVENTS ==================
searchBtn.addEventListener("click", getProfile)
steamInput.addEventListener("keydown", e => {
  if (e.key === "Enter") getProfile()
})

// ================== MAIN ==================
async function getProfile() {
  const input = steamInput.value.trim()
  if (!input) return

  // Captcha kontrolü
  if (!currentTurnstileToken) {
    result.innerHTML = `
      <div class="card error-card">
        Lütfen captcha doğrulamasını tamamla.
      </div>
    `
    return
  }

  // Loading state
  result.innerHTML = `
    <div class="card loading-card">
      <div class="loader"></div>
      <div>Analiz hazırlanıyor...</div>
    </div>
  `

  let res
  try {
    res = await fetch(
      API_URL + "?steamid=" + encodeURIComponent(input),
      {
        headers: {
          "X-Turnstile-Token": currentTurnstileToken
        }
      }
    )
  } catch (err) {
    result.innerHTML = `
      <div class="card error-card">
        Sunucuya bağlanılamadı.
      </div>
    `
    resetTurnstile()
    return
  }

  // Token tek kullanımlık
  resetTurnstile()

  if (!res.ok) {
    let msg = "Sunucu hatası"
    try {
      const e = await res.json()
      msg = e?.error || e?.message || msg
    } catch {}

    result.innerHTML = `
      <div class="card error-card">
        ${msg}
      </div>
    `
    return
  }

  const data = await res.json()

  // ================== PROFILE COMPLETENESS ==================
  const pc = data.profileCompleteness ?? 0

  const pcLabel =
    pc > 70 ? "Dolu" :
    pc > 40 ? "Orta" :
    "Zayıf"

  const pcClass =
    pc > 70 ? "trust-high" :
    pc > 40 ? "trust-mid" :
    "trust-low"

  // ================== RENDER ==================
  result.innerHTML = `
    <div class="card profile-card">
      <div class="profile-header">
        <img src="${data.profile.avatarfull}" alt="avatar">
        <div>
          <div class="profile-name">${data.profile.personaname}</div>
          <div class="profile-sub">
            Steam Level: ${data.steamLevel ?? "?"}
          </div>
        </div>
      </div>
    </div>

    <div class="card glow-card">
      <div class="card-title">Profil Doluluğu</div>

      <div class="trust-wrapper">
        <div class="trust-header">
          <span class="trust-score">${pc}/100</span>
          <span class="trust-label ${pcClass}">${pcLabel}</span>
        </div>

        <div class="trust-bar-bg">
          <div class="trust-bar-fill" style="width:${pc}%"></div>
        </div>

        <small class="muted">
          Steam’in herkese açık sunduğu profil sinyallerine göre hesaplanır.
        </small>
      </div>
    </div>
  `
}

// ================== HELPERS ==================
function resetTurnstile() {
  currentTurnstileToken = null
  if (window.turnstile) {
    window.turnstile.reset()
  }
}
