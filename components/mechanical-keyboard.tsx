"use client"

import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime"
import { useState, useEffect, useCallback, useMemo, startTransition, useRef, memo } from "react"
import { addPropertyControls, ControlType } from "framer"

// ===================================================================
// Typing-practice support (Cybersecurity content via GLM)
// ===================================================================

const TARGET_QUEUE_SIZE = 10

// Shape of every typing item — the English target plus its Arabic phonetic
// transliteration (how the English is pronounced, NOT a translation).
type SentenceItem = { text: string; ar: string }

// Local fallback items. Used while the AI batch is loading, or if the
// upstream API ever fails — so the experience never blocks on the network.
const FALLBACK_SENTENCES: SentenceItem[] = [
  // Hand-vowelled so a child reading literally produces a recognisable
  // English pronunciation. Strict rules applied:
  //   * final "-er/-or/-ar" schwa  -> fatha ـَ  (never damma)
  //   * "ay" diphthong (safe/say)  -> fatha + ي ("سَيف" not "سيِف")
  //   * "ow" diphthong (account)   -> fatha + ا + سكون on و ("أَكاوْنت")
  //   * short English "a" (attack) -> "أَ" not long "ا" ("أَتَك" not "أتاك")
  {
    text: "Strong passwords with MFA keep your account safe from attackers.",
    ar: "سْترونغ باسْوَردز وِذ إم إف إيه كيب يور أَكاوْنت سَيف فْرَم أَتَكَرز."
  },
  {
    text: "Phishing emails impersonate trusted senders to steal credentials.",
    ar: "فِشِنغ إيميلز إمبَرسُنيت تْرَستِد سَندَرز تو ستيل كْرِدِنشَلز."
  },
  {
    text: "Encrypting data at rest and in transit is a core principle.",
    ar: "إنكْرِبتِنغ داتا آت رست آند إن تْرانزِت إز أَ كور بْرِنسِبَل."
  },
  {
    text: "Firewalls enforce policies between trusted and untrusted zones.",
    ar: "فاير وولز إنفورس بوليسيز بِتوين تْرَستِد آند أَنتْرَستِد زونز."
  },
  {
    text: "Zero trust assumes no user or device is inherently trustworthy.",
    ar: "زيرو تْرَست أَسيومز نو يُوزَر أور دِفايس إز إنهيرَنتلي تْرَستوَرذي."
  },
  {
    text: "Patching software closes flaws before attackers exploit them.",
    ar: "باتشِنغ سوفتوير كلوزِز فلوز بِفور أَتَكَرز إكسبلويت ذِم."
  },
  {
    text: "A SOC monitors alerts and responds to incidents in real time.",
    ar: "أَ إس أو سي مونِتَرز أَلَرتس آند رِسبوندز تو إنسِدَنتس إن ريل تايم."
  },
  {
    text: "Ransomware encrypts files and demands a ransom payment.",
    ar: "رانْسَم وير إنكْرِبتس فايلز آند دِماندز أَ رانْسَم بايمَنت."
  },
  {
    text: "Network segmentation limits the blast radius of a breach.",
    ar: "نِتوَرك سِغمِنتيشَن لِمِتس ذا بلاست ريديَس أَف أَ بْريتش."
  },
  {
    text: "Threat intelligence helps defenders anticipate adversary tactics.",
    ar: "ثرِت إنتِلِجِنس هِلبس دِفِندَرز أَنتِسِبيت أَدفَرسَري تاكتِكس."
  },
]

// Lazily-initialised AudioContext shared across keypress sound calls.
// Audio nodes are cheap to create per-press; the context is the expensive part,
// so we keep one alive for the page lifetime.
let __audioCtx: any = null
let __noiseBuf: AudioBuffer | null = null

function getAudioCtx(): any {
  if (typeof window === "undefined") return null
  if (__audioCtx) return __audioCtx
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return null
    __audioCtx = new Ctx()
    return __audioCtx
  } catch {
    return null
  }
}

// Pre-generate a 50ms exponentially-decaying noise buffer once. This is the
// click "attack" — generating it per-press is wasteful and adds jitter.
function getNoiseBuffer(ctx: any): AudioBuffer | null {
  if (__noiseBuf) return __noiseBuf
  try {
    const len = Math.floor(0.05 * ctx.sampleRate)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      // White noise shaped by a quartic decay envelope.
      const env = Math.pow(1 - i / len, 4)
      data[i] = (Math.random() * 2 - 1) * env
    }
    __noiseBuf = buf
    return buf
  } catch {
    return null
  }
}

// Warm up the AudioContext on the first user gesture. Browsers require a
// user-gesture-initiated resume; doing this once removes the perceptible
// lag on the very first keypress.
function warmupAudio() {
  const ctx = getAudioCtx()
  if (!ctx) return
  if (ctx.state === "suspended") ctx.resume().catch(() => { })
  // Pre-build the noise buffer so the first real keypress doesn't pay for it.
  getNoiseBuffer(ctx)
}

function playKeySound() {
  const ctx = getAudioCtx()
  if (!ctx) return
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => { })
    const now = ctx.currentTime

    // Layer 1 — the "click": a short filtered noise burst. This is what
    // gives a real mechanical keyboard its characteristic snap.
    const noiseBuf = getNoiseBuffer(ctx)
    if (noiseBuf) {
      const src = ctx.createBufferSource()
      src.buffer = noiseBuf
      const filter = ctx.createBiquadFilter()
      filter.type = "bandpass"
      filter.frequency.value = 2600 + Math.random() * 600 // slight per-key variation
      filter.Q.value = 4
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.22, now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.035)
      src.connect(filter).connect(g).connect(ctx.destination)
      src.start(now)
      src.stop(now + 0.05)
    }

    // Layer 2 — the "thock": a low body tone that decays quickly.
    const osc = ctx.createOscillator()
    const g2 = ctx.createGain()
    osc.type = "sine"
    const base = 170 + Math.random() * 30
    osc.frequency.setValueAtTime(base, now)
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.04)
    g2.gain.setValueAtTime(0.0001, now)
    g2.gain.linearRampToValueAtTime(0.09, now + 0.003)
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
    osc.connect(g2).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.07)
  } catch {
    // Audio is best-effort; ignore failures.
  }
}

async function fetchSentencesFromApi(
  count: number,
  excludeList: string[],
): Promise<SentenceItem[]> {
  try {
    const res = await fetch("/api/generate-sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, excludeList }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const list = Array.isArray(data?.sentences) ? data.sentences : []
    return list.filter(
      (s: any) =>
        s &&
        typeof s.text === "string" &&
        s.text.trim().length > 0 &&
        typeof s.ar === "string" &&
        s.ar.trim().length > 0,
    ) as SentenceItem[]
  } catch {
    return []
  }
}

function pickFallback(used: Set<string>): SentenceItem {
  for (const s of FALLBACK_SENTENCES) {
    if (!used.has(s.text.toLowerCase().trim())) return s
  }
  // If we've exhausted the local pool, return any (still always a valid item).
  return FALLBACK_SENTENCES[Math.floor(Math.random() * FALLBACK_SENTENCES.length)]
}

/**
 * Hyper-realistic mechanical keyboard with tactile feedback and a
 * cybersecurity-themed typing-practice display.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function MechanicalKeyboard(props) {
  const {
    keyboardVariant = "regular",
    keyboardColor = "#2a2a2a",
    textColor = "#ffffff",
    backgroundColor = "#121212",
    transparentBackground = false,
    specialKeyboardColor = "#C0C0C0",
    windowsKeyImage = {
      src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/transferir%20%2818%29-IpHagyUwliotpr8JT0eR3JmrV3DNhD.png",
      alt: "v0",
    },
    appleKeyImage = {
      src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/transferir%20%2818%29-IpHagyUwliotpr8JT0eR3JmrV3DNhD.png",
      alt: "v0",
    },
    customKeycapImages = [],
    keyRemappings = [],
    keyFont,
    showTextPreview = true,
  } = props

  // ---- Typing-practice state ----
  const [currentSentence, setCurrentSentence] = useState<SentenceItem | null>(null)
  const [typedText, setTypedText] = useState("")
  const [sentenceQueue, setSentenceQueue] = useState<SentenceItem[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const [isInitializing, setIsInitializing] = useState(true)
  const [statusMessage, setStatusMessage] = useState("Preparing cybersecurity sentences...")
  // (Old isTransitioning state removed — the transition is now driven purely
  // by a CSS key-remount animation so input is never blocked.)
  // Master de-duplication set: everything ever shown OR queued, lowercased.
  const usedSentencesRef = useRef<Set<string>>(new Set())
  const isRefillingRef = useRef(false)

  // ---- Keyboard UI state (unchanged) ----
  const [capsLock, setCapsLock] = useState(false)
  const [pressedKeys, setPressedKeys] = useState(new Set())
  const [lastPressedKey, setLastPressedKey] = useState(null)
  const [showCursor, setShowCursor] = useState(true)
  const [showNumbers, setShowNumbers] = useState(false)
  const containerRef = useRef(null)
  const keyPressTimeoutRef = useRef(null)

  // Create a map of remapped keys for quick lookup
  const keyRemappingMap = useMemo(() => {
    const map = {}
    keyRemappings.forEach((item) => {
      if (item.originalKey && item.remappedTo) {
        map[item.originalKey] = item.remappedTo
      }
    })
    return map
  }, [keyRemappings])

  // Key layout configuration with remapped labels
  const keyboardLayout = useMemo(() => {
    if (keyboardVariant === "mobile") {
      // Mobile phone keyboard layout
      if (showNumbers) {
        return [
          [
            { key: "1", label: keyRemappingMap["1"] || "1", width: 1 },
            { key: "2", label: keyRemappingMap["2"] || "2", width: 1 },
            { key: "3", label: keyRemappingMap["3"] || "3", width: 1 },
            { key: "4", label: keyRemappingMap["4"] || "4", width: 1 },
            { key: "5", label: keyRemappingMap["5"] || "5", width: 1 },
            { key: "6", label: keyRemappingMap["6"] || "6", width: 1 },
            { key: "7", label: keyRemappingMap["7"] || "7", width: 1 },
            { key: "8", label: keyRemappingMap["8"] || "8", width: 1 },
            { key: "9", label: keyRemappingMap["9"] || "9", width: 1 },
            { key: "0", label: keyRemappingMap["0"] || "0", width: 1 },
          ],
          [
            { key: "-", label: keyRemappingMap["-"] || "-", width: 1 },
            { key: "/", label: keyRemappingMap["/"] || "/", width: 1 },
            { key: ":", label: ":", width: 1 },
            { key: ";", label: keyRemappingMap[";"] || ";", width: 1 },
            { key: "(", label: "(", width: 1 },
            { key: ")", label: ")", width: 1 },
            { key: "$", label: "$", width: 1 },
            { key: "&", label: "&", width: 1 },
            { key: "@", label: "@", width: 1 },
            { key: '"', label: '"', width: 1 },
          ],
          [
            { key: "NumberToggle", label: "#+=", width: 1.5, isSpecial: true },
            { key: ".", label: keyRemappingMap["."] || ".", width: 1 },
            { key: ",", label: keyRemappingMap[","] || ",", width: 1 },
            { key: "?", label: "?", width: 1 },
            { key: "!", label: "!", width: 1 },
            { key: "'", label: keyRemappingMap["'"] || "'", width: 1 },
            { key: '"', label: '"', width: 1 },
            { key: "|", label: "|", width: 1 },
            { key: "_", label: "_", width: 1 },
            { key: "Backspace", label: "⌫", width: 1.5, isSpecial: true },
          ],
          [
            { key: "ABC", label: "ABC", width: 1.5, isSpecial: true },
            { key: " ", label: "", width: 7 },
            { key: "Enter", label: "↵", width: 1.5, isSpecial: true },
          ],
        ]
      } else {
        return [
          [
            { key: "q", label: keyRemappingMap["q"] || (capsLock ? "Q" : "q"), width: 1 },
            { key: "w", label: keyRemappingMap["w"] || (capsLock ? "W" : "w"), width: 1 },
            { key: "e", label: keyRemappingMap["e"] || (capsLock ? "E" : "e"), width: 1 },
            { key: "r", label: keyRemappingMap["r"] || (capsLock ? "R" : "r"), width: 1 },
            { key: "t", label: keyRemappingMap["t"] || (capsLock ? "T" : "t"), width: 1 },
            { key: "y", label: keyRemappingMap["y"] || (capsLock ? "Y" : "y"), width: 1 },
            { key: "u", label: keyRemappingMap["u"] || (capsLock ? "U" : "u"), width: 1 },
            { key: "i", label: keyRemappingMap["i"] || (capsLock ? "I" : "i"), width: 1 },
            { key: "o", label: keyRemappingMap["o"] || (capsLock ? "O" : "o"), width: 1 },
            { key: "p", label: keyRemappingMap["p"] || (capsLock ? "P" : "p"), width: 1 },
          ],
          [
            { key: "a", label: keyRemappingMap["a"] || (capsLock ? "A" : "a"), width: 1 },
            { key: "s", label: keyRemappingMap["s"] || (capsLock ? "S" : "s"), width: 1 },
            { key: "d", label: keyRemappingMap["d"] || (capsLock ? "D" : "d"), width: 1 },
            { key: "f", label: keyRemappingMap["f"] || (capsLock ? "F" : "f"), width: 1 },
            { key: "g", label: keyRemappingMap["g"] || (capsLock ? "G" : "g"), width: 1 },
            { key: "h", label: keyRemappingMap["h"] || (capsLock ? "H" : "h"), width: 1 },
            { key: "j", label: keyRemappingMap["j"] || (capsLock ? "J" : "j"), width: 1 },
            { key: "k", label: keyRemappingMap["k"] || (capsLock ? "K" : "k"), width: 1 },
            { key: "l", label: keyRemappingMap["l"] || (capsLock ? "L" : "l"), width: 1 },
          ],
          [
            { key: "CapsLock", label: capsLock ? "⇪" : "⇧", width: 1.5, active: capsLock, isSpecial: true },
            { key: "z", label: keyRemappingMap["z"] || (capsLock ? "Z" : "z"), width: 1 },
            { key: "x", label: keyRemappingMap["x"] || (capsLock ? "X" : "x"), width: 1 },
            { key: "c", label: keyRemappingMap["c"] || (capsLock ? "C" : "c"), width: 1 },
            { key: "v", label: keyRemappingMap["v"] || (capsLock ? "V" : "v"), width: 1 },
            { key: "b", label: keyRemappingMap["b"] || (capsLock ? "B" : "b"), width: 1 },
            { key: "n", label: keyRemappingMap["n"] || (capsLock ? "N" : "n"), width: 1 },
            { key: "m", label: keyRemappingMap["m"] || (capsLock ? "M" : "m"), width: 1 },
            { key: "Backspace", label: "⌫", width: 1.5, isSpecial: true },
          ],
          [
            { key: "123", label: "123", width: 1.5, isSpecial: true },
            { key: ",", label: keyRemappingMap[","] || ",", width: 1 },
            { key: " ", label: "", width: 5 },
            { key: ".", label: keyRemappingMap["."] || ".", width: 1 },
            { key: "Enter", label: "↵", width: 1.5, isSpecial: true },
          ],
        ]
      }
    } else if (keyboardVariant === "apple") {
      // Apple butterfly keyboard layout
      return [
        [
          { key: "Escape", label: "esc", width: 1 },
          { key: "F1", label: "F1", width: 1 },
          { key: "F2", label: "F2", width: 1 },
          { key: "F3", label: "F3", width: 1 },
          { key: "F4", label: "F4", width: 1 },
          { key: "F5", label: "F5", width: 1 },
          { key: "F6", label: "F6", width: 1 },
          { key: "F7", label: "F7", width: 1 },
          { key: "F8", label: "F8", width: 1 },
          { key: "F9", label: "F9", width: 1 },
          { key: "F10", label: "F10", width: 1 },
          { key: "F11", label: "F11", width: 1 },
          { key: "F12", label: "F12", width: 1 },
          { key: "Power", label: "⏻", width: 1 },
        ],
        [
          { key: "`", label: keyRemappingMap["`"] || "`", width: 1 },
          { key: "1", label: keyRemappingMap["1"] || "1", width: 1 },
          { key: "2", label: keyRemappingMap["2"] || "2", width: 1 },
          { key: "3", label: keyRemappingMap["3"] || "3", width: 1 },
          { key: "4", label: keyRemappingMap["4"] || "4", width: 1 },
          { key: "5", label: keyRemappingMap["5"] || "5", width: 1 },
          { key: "6", label: keyRemappingMap["6"] || "6", width: 1 },
          { key: "7", label: keyRemappingMap["7"] || "7", width: 1 },
          { key: "8", label: keyRemappingMap["8"] || "8", width: 1 },
          { key: "9", label: keyRemappingMap["9"] || "9", width: 1 },
          { key: "0", label: keyRemappingMap["0"] || "0", width: 1 },
          { key: "-", label: keyRemappingMap["-"] || "-", width: 1 },
          { key: "=", label: keyRemappingMap["="] || "=", width: 1 },
          { key: "Backspace", label: "delete", width: 1.5 },
        ],
        [
          { key: "Tab", label: "tab", width: 1.5 },
          { key: "q", label: keyRemappingMap["q"] || "q", width: 1 },
          { key: "w", label: keyRemappingMap["w"] || "w", width: 1 },
          { key: "e", label: keyRemappingMap["e"] || "e", width: 1 },
          { key: "r", label: keyRemappingMap["r"] || "r", width: 1 },
          { key: "t", label: keyRemappingMap["t"] || "t", width: 1 },
          { key: "y", label: keyRemappingMap["y"] || "y", width: 1 },
          { key: "u", label: keyRemappingMap["u"] || "u", width: 1 },
          { key: "i", label: keyRemappingMap["i"] || "i", width: 1 },
          { key: "o", label: keyRemappingMap["o"] || "o", width: 1 },
          { key: "p", label: keyRemappingMap["p"] || "p", width: 1 },
          { key: "[", label: keyRemappingMap["["] || "[", width: 1 },
          { key: "]", label: keyRemappingMap["]"] || "]", width: 1 },
          { key: "\\", label: keyRemappingMap["\\"] || "\\", width: 1.5 },
        ],
        [
          { key: "CapsLock", label: "caps lock", width: 1.75, active: capsLock },
          { key: "a", label: keyRemappingMap["a"] || "a", width: 1 },
          { key: "s", label: keyRemappingMap["s"] || "s", width: 1 },
          { key: "d", label: keyRemappingMap["d"] || "d", width: 1 },
          { key: "f", label: keyRemappingMap["f"] || "f", width: 1 },
          { key: "g", label: keyRemappingMap["g"] || "g", width: 1 },
          { key: "h", label: keyRemappingMap["h"] || "h", width: 1 },
          { key: "j", label: keyRemappingMap["j"] || "j", width: 1 },
          { key: "k", label: keyRemappingMap["k"] || "k", width: 1 },
          { key: "l", label: keyRemappingMap["l"] || "l", width: 1 },
          { key: ";", label: keyRemappingMap[";"] || ";", width: 1 },
          { key: "'", label: keyRemappingMap["'"] || "'", width: 1 },
          { key: "Enter", label: "return", width: 2.25 },
        ],
        [
          { key: "ShiftLeft", label: "shift", width: 2.25 },
          { key: "z", label: keyRemappingMap["z"] || "z", width: 1 },
          { key: "x", label: keyRemappingMap["x"] || "x", width: 1 },
          { key: "c", label: keyRemappingMap["c"] || "c", width: 1 },
          { key: "v", label: keyRemappingMap["v"] || "v", width: 1 },
          { key: "b", label: keyRemappingMap["b"] || "b", width: 1 },
          { key: "n", label: keyRemappingMap["n"] || "n", width: 1 },
          { key: "m", label: keyRemappingMap["m"] || "m", width: 1 },
          { key: ",", label: keyRemappingMap[","] || ",", width: 1 },
          { key: ".", label: keyRemappingMap["."] || ".", width: 1 },
          { key: "/", label: keyRemappingMap["/"] || "/", width: 1 },
          { key: "ShiftRight", label: "shift", width: 2.75 },
        ],
        [
          { key: "Fn", label: "fn", width: 1 },
          { key: "ControlLeft", label: "⌃", width: 1 },
          { key: "AltLeft", label: "option", width: 1 },
          {
            key: "MetaLeft",
            label: /*#__PURE__*/ _jsx("img", {
              src: appleKeyImage.src,
              alt: appleKeyImage.alt,
              style: { width: "16px", height: "16px" },
            }),
            width: 1.25,
          },
          { key: " ", label: "", width: 5 },
          {
            key: "MetaRight",
            label: /*#__PURE__*/ _jsx("img", {
              src: appleKeyImage.src,
              alt: appleKeyImage.alt,
              style: { width: "16px", height: "16px" },
            }),
            width: 1.25,
          },
          { key: "AltRight", label: "option", width: 1 },
          { key: "ArrowLeft", label: "◀", width: 1 },
          { key: "ArrowUp", label: "▲", width: 1 },
          { key: "ArrowDown", label: "▼", width: 1 },
          { key: "ArrowRight", label: "▶", width: 1 },
        ],
      ]
    } else {
      // Regular keyboard layout
      return [
        [
          { key: "Escape", label: "Esc", width: 1, isSpecial: true },
          { key: "F1", label: "F1", width: 1, isSpecial: true },
          { key: "F2", label: "F2", width: 1, isSpecial: true },
          { key: "F3", label: "F3", width: 1, isSpecial: true },
          { key: "F4", label: "F4", width: 1, isSpecial: true },
          { key: "F5", label: "F5", width: 1, isSpecial: true },
          { key: "F6", label: "F6", width: 1, isSpecial: true },
          { key: "F7", label: "F7", width: 1, isSpecial: true },
          { key: "F8", label: "F8", width: 1, isSpecial: true },
          { key: "F9", label: "F9", width: 1, isSpecial: true },
          { key: "F10", label: "F10", width: 1, isSpecial: true },
          { key: "F11", label: "F11", width: 1, isSpecial: true },
          { key: "F12", label: "F12", width: 1, isSpecial: true },
        ],
        [
          { key: "`", label: keyRemappingMap["`"] || "`", width: 1, isSpecial: true },
          { key: "1", label: keyRemappingMap["1"] || "1", width: 1 },
          { key: "2", label: keyRemappingMap["2"] || "2", width: 1 },
          { key: "3", label: keyRemappingMap["3"] || "3", width: 1 },
          { key: "4", label: keyRemappingMap["4"] || "4", width: 1 },
          { key: "5", label: keyRemappingMap["5"] || "5", width: 1 },
          { key: "6", label: keyRemappingMap["6"] || "6", width: 1 },
          { key: "7", label: keyRemappingMap["7"] || "7", width: 1 },
          { key: "8", label: keyRemappingMap["8"] || "8", width: 1 },
          { key: "9", label: keyRemappingMap["9"] || "9", width: 1 },
          { key: "0", label: keyRemappingMap["0"] || "0", width: 1 },
          { key: "-", label: keyRemappingMap["-"] || "-", width: 1 },
          { key: "=", label: keyRemappingMap["="] || "=", width: 1 },
          { key: "Backspace", label: "⌫", width: 2, isSpecial: true },
        ],
        [
          { key: "Tab", label: "Tab", width: 1.5, isSpecial: true },
          { key: "q", label: keyRemappingMap["q"] || "Q", width: 1 },
          { key: "w", label: keyRemappingMap["w"] || "W", width: 1 },
          { key: "e", label: keyRemappingMap["e"] || "E", width: 1 },
          { key: "r", label: keyRemappingMap["r"] || "R", width: 1 },
          { key: "t", label: keyRemappingMap["t"] || "T", width: 1 },
          { key: "y", label: keyRemappingMap["y"] || "Y", width: 1 },
          { key: "u", label: keyRemappingMap["u"] || "U", width: 1 },
          { key: "i", label: keyRemappingMap["i"] || "I", width: 1 },
          { key: "o", label: keyRemappingMap["o"] || "O", width: 1 },
          { key: "p", label: keyRemappingMap["p"] || "P", width: 1 },
          { key: "[", label: keyRemappingMap["["] || "[", width: 1 },
          { key: "]", label: keyRemappingMap["]"] || "]", width: 1 },
          { key: "\\", label: keyRemappingMap["\\"] || "\\", width: 1.5 },
        ],
        [
          { key: "CapsLock", label: "Caps", width: 1.75, active: capsLock, isSpecial: true },
          { key: "a", label: keyRemappingMap["a"] || "A", width: 1 },
          { key: "s", label: keyRemappingMap["s"] || "S", width: 1 },
          { key: "d", label: keyRemappingMap["d"] || "D", width: 1 },
          { key: "f", label: keyRemappingMap["f"] || "F", width: 1 },
          { key: "g", label: keyRemappingMap["g"] || "G", width: 1 },
          { key: "h", label: keyRemappingMap["h"] || "H", width: 1 },
          { key: "j", label: keyRemappingMap["j"] || "J", width: 1 },
          { key: "k", label: keyRemappingMap["k"] || "K", width: 1 },
          { key: "l", label: keyRemappingMap["l"] || "L", width: 1 },
          { key: ";", label: keyRemappingMap[";"] || ";", width: 1 },
          { key: "'", label: keyRemappingMap["'"] || "'", width: 1 },
          { key: "Enter", label: "Enter", width: 2.25, isSpecial: true },
        ],
        [
          { key: "ShiftLeft", label: "Shift", width: 2.25, isSpecial: true },
          { key: "z", label: keyRemappingMap["z"] || "Z", width: 1 },
          { key: "x", label: keyRemappingMap["x"] || "X", width: 1 },
          { key: "c", label: keyRemappingMap["c"] || "C", width: 1 },
          { key: "v", label: keyRemappingMap["v"] || "V", width: 1 },
          { key: "b", label: keyRemappingMap["b"] || "B", width: 1 },
          { key: "n", label: keyRemappingMap["n"] || "N", width: 1 },
          { key: "m", label: keyRemappingMap["m"] || "M", width: 1 },
          { key: ",", label: keyRemappingMap[","] || ",", width: 1 },
          { key: ".", label: keyRemappingMap["."] || ".", width: 1 },
          { key: "/", label: keyRemappingMap["/"] || "/", width: 1 },
          { key: "ShiftRight", label: "Shift", width: 2.75, isSpecial: true },
        ],
        [
          { key: "ControlLeft", label: "Ctrl", width: 1.25, isSpecial: true },
          {
            key: "MetaLeft",
            label: /*#__PURE__*/ _jsx("img", {
              src: windowsKeyImage.src,
              alt: windowsKeyImage.alt,
              style: { width: "16px", height: "16px" },
            }),
            width: 1.25,
            isSpecial: true,
          },
          { key: "AltLeft", label: "Alt", width: 1.25, isSpecial: true },
          { key: " ", label: "", width: 6.25 },
          { key: "AltRight", label: "Alt", width: 1.25, isSpecial: true },
          {
            key: "MetaRight",
            label: /*#__PURE__*/ _jsx("img", {
              src: windowsKeyImage.src,
              alt: windowsKeyImage.alt,
              style: { width: "16px", height: "16px" },
            }),
            width: 1.25,
            isSpecial: true,
          },
          { key: "ContextMenu", label: "Menu", width: 1.25, isSpecial: true },
          { key: "ControlRight", label: "Ctrl", width: 1.25, isSpecial: true },
        ],
      ]
    }
  }, [capsLock, windowsKeyImage, appleKeyImage, keyRemappingMap, keyboardVariant, showNumbers])

  // Define special keys list (unchanged)
  const specialKeys = useMemo(
    () => [
      "Escape",
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12",
      "Power",
      "Backspace",
      "Tab",
      "CapsLock",
      "Enter",
      "ShiftLeft",
      "ShiftRight",
      "ControlLeft",
      "ControlRight",
      "AltLeft",
      "AltRight",
      "MetaLeft",
      "MetaRight",
      "ContextMenu",
      "Fn",
    ],
    [],
  )

  // ---- Sentence queue management ----

  // Kick off a background refill if the queue is below the target size.
  const refillQueue = useCallback(async () => {
    if (isRefillingRef.current) return
    isRefillingRef.current = true
    try {
      // Loop until we have at least TARGET_QUEUE_SIZE in the queue.
      // Each iteration fetches one sentence to keep the request small,
      // while the latest exclusion list grows over time.
      // Bail after a few iterations to avoid hammering the API on failure.
      for (let attempt = 0; attempt < TARGET_QUEUE_SIZE; attempt++) {
        // Note: we read the latest state via the functional setter below.
        let needAnother = false
        await new Promise<void>((resolve) => {
          setSentenceQueue((current) => {
            if (current.length >= TARGET_QUEUE_SIZE) {
              needAnother = false
              resolve()
              return current
            }
            needAnother = true
            resolve()
            return current
          })
        })
        if (!needAnother) break

        const exclude = Array.from(usedSentencesRef.current)
        const fresh = await fetchSentencesFromApi(1, exclude)
        const accepted: SentenceItem[] = []
        for (const s of fresh) {
          const key = s.text.toLowerCase().trim()
          if (!usedSentencesRef.current.has(key)) {
            usedSentencesRef.current.add(key)
            accepted.push(s)
          }
        }
        if (accepted.length === 0) {
          // Upstream gave us nothing usable — stop trying for now.
          break
        }
        setSentenceQueue((prev) => [...prev, ...accepted])
      }
    } finally {
      isRefillingRef.current = false
    }
  }, [])

  // Pull the next sentence from the queue and refresh state.
  const advanceToNext = useCallback(() => {
    setSentenceQueue((prev) => {
      if (prev.length > 0) {
        const [next, ...rest] = prev
        setCurrentSentence(next)
        return rest
      }
      // Queue is empty — fall back to a local sentence so the user never
      // gets stuck waiting on the network mid-session.
      const fallback = pickFallback(usedSentencesRef.current)
      usedSentencesRef.current.add(fallback.text.toLowerCase().trim())
      setCurrentSentence(fallback)
      return prev
    })
    setTypedText("")
    setCompletedCount((c) => c + 1)
    // Schedule a background refill to top the queue back up.
    refillQueue()
  }, [refillQueue])

  // Initial load: try to fetch the full batch of 10 from the AI.
  useEffect(() => {
    let cancelled = false
      ; (async () => {
        setIsInitializing(true)
        setStatusMessage("Generating 10 cybersecurity sentences with GLM...")

        const fetched = await fetchSentencesFromApi(TARGET_QUEUE_SIZE, [])
        if (cancelled) return

        const unique: SentenceItem[] = []
        const seen = new Set<string>()
        for (const s of fetched) {
          const key = s.text.toLowerCase().trim()
          if (!seen.has(key)) {
            seen.add(key)
            unique.push(s)
          }
        }

        // Fill any shortfall from local fallback to guarantee 10 ready-to-go.
        if (unique.length < TARGET_QUEUE_SIZE) {
          for (const fb of FALLBACK_SENTENCES) {
            const key = fb.text.toLowerCase().trim()
            if (!seen.has(key)) {
              seen.add(key)
              unique.push(fb)
            }
            if (unique.length >= TARGET_QUEUE_SIZE) break
          }
        }

        const batch = unique.slice(0, TARGET_QUEUE_SIZE)
        batch.forEach((s) => usedSentencesRef.current.add(s.text.toLowerCase().trim()))

        const [first, ...rest] = batch
        setCurrentSentence(first ?? null)
        setSentenceQueue(rest)
        setIsInitializing(false)
        setStatusMessage("")

        // If we had to top up with fallbacks, immediately try to refill with
        // fresh AI content in the background.
        if (fetched.length < TARGET_QUEUE_SIZE) {
          refillQueue()
        }
      })()
    return () => {
      cancelled = true
    }
  }, [refillQueue])

  // ---- Typing input dispatchers ----

  const processTypedChar = useCallback(
    (char: string) => {
      if (!currentSentence) return
      const target = currentSentence.text
      playKeySound()
      setTypedText((prev) => {
        // Never grow past the sentence length — overshoots are rejected so
        // the layout stays stable and the user must backspace to correct.
        if (prev.length >= target.length) return prev
        const next = prev + char
        if (next === target) {
          // Advance on the next macrotask so React paints the completion
          // frame first. NO blocking flag — fast typers can carry straight
          // into the next sentence without losing keystrokes.
          window.setTimeout(() => advanceToNext(), 0)
        }
        return next
      })
    },
    [currentSentence, advanceToNext],
  )

  const processBackspace = useCallback(() => {
    playKeySound()
    setTypedText((prev) => prev.slice(0, -1))
  }, [])

  // Handle physical keyboard input
  const handleKeyDown = useCallback(
    (e) => {
      e.preventDefault()
      const key = e.code
      startTransition(() => {
        setPressedKeys((prev) => {
          if (prev.has(key)) return prev
          const newSet = new Set(prev)
          newSet.add(key)
          return newSet
        })
        setLastPressedKey(key)
      })

      if (key === "CapsLock") {
        startTransition(() => setCapsLock((prev) => !prev))
        return
      }
      if (key === "Backspace") {
        processBackspace()
        return
      }
      if (key === "Enter" || key === "Tab" || key.startsWith("F") || key === "Escape") {
        // Ignored in typing-practice mode.
        return
      }
      if (key === "Space") {
        processTypedChar(" ")
        return
      }

      let char = e.key
      if (typeof char === "string" && char.length === 1) {
        const remappedChar = keyRemappingMap[char.toLowerCase()]
        if (remappedChar) char = remappedChar
        processTypedChar(char)
      }
    },
    [keyRemappingMap, processTypedChar, processBackspace],
  )

  const handleKeyUp = useCallback((e) => {
    const key = e.code
    startTransition(() => {
      setPressedKeys((prev) => {
        if (!prev.has(key)) return prev
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    })
  }, [])

  // Handle Windows key click
  const handleWindowsKeyClick = useCallback(() => {
    if (props.specialKeyLink) {
      if (typeof window !== "undefined") {
        window.open(props.specialKeyLink, "_blank")
      }
    }
  }, [props.specialKeyLink])

  // Handle on-screen keyboard clicks
  const handleKeyClick = useCallback(
    (keyData) => {
      startTransition(() => setLastPressedKey(keyData.key))

      if (keyData.key === "CapsLock") {
        startTransition(() => setCapsLock((prev) => !prev))
        return
      }
      if (keyData.key === "Backspace") {
        processBackspace()
        return
      }
      if (keyData.key === "Enter") {
        // Ignored in typing-practice mode.
        return
      }
      if (keyData.key === " ") {
        processTypedChar(" ")
        return
      }

      // Skip function keys and modifier keys
      if (
        keyData.key.startsWith("F") ||
        keyData.key.includes("Shift") ||
        keyData.key.includes("Control") ||
        keyData.key.includes("Alt") ||
        keyData.key.includes("Meta") ||
        keyData.key.includes("Escape") ||
        keyData.key.includes("Tab") ||
        keyData.key.includes("ContextMenu")
      ) {
        return
      }

      let char = keyData.key
      if (typeof char === "string" && char.length === 1) {
        const remappedChar = keyRemappingMap[char.toLowerCase()]
        if (remappedChar) char = remappedChar
        if (capsLock) char = char.toUpperCase()
        processTypedChar(char)
      }
    },
    [capsLock, keyRemappingMap, processTypedChar, processBackspace],
  )

  // Warm up AudioContext on first user interaction so the very first
  // keypress has no perceptible audio latency.
  useEffect(() => {
    if (typeof window === "undefined") return
    const onFirstInteraction = () => {
      warmupAudio()
      window.removeEventListener("pointerdown", onFirstInteraction)
      window.removeEventListener("keydown", onFirstInteraction)
    }
    window.addEventListener("pointerdown", onFirstInteraction, { once: true })
    window.addEventListener("keydown", onFirstInteraction, { once: true })
    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction)
      window.removeEventListener("keydown", onFirstInteraction)
    }
  }, [])

  // Set up keyboard event listeners
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown)
      window.addEventListener("keyup", handleKeyUp)
      return () => {
        window.removeEventListener("keydown", handleKeyDown)
        window.removeEventListener("keyup", handleKeyUp)
      }
    }
  }, [handleKeyDown, handleKeyUp])

  // Blinking cursor effect
  useEffect(() => {
    if (!showTextPreview || typeof window === "undefined") {
      setShowCursor(true)
      return
    }
    const interval = setInterval(() => {
      startTransition(() => setShowCursor((prev) => !prev))
    }, 530)
    return () => clearInterval(interval)
  }, [showTextPreview])

  // Base key size
  const keySize = 40
  const keyGap = 4

  // Create a map of custom keycap images for quick lookup
  const customKeycapImageMap = useMemo(() => {
    const map = {}
    customKeycapImages.forEach((item) => {
      if (item.key && item.image && item.image.src) {
        map[item.key] = item.image
      }
    })
    return map
  }, [customKeycapImages])

  // Memoize key rendering to avoid re-renders
  const renderKey = useCallback(
    (keyData, rowIndex, keyIndex) => {
      const isPressed = pressedKeys.has(keyData.key)
      return /*#__PURE__*/ _jsx(
        KeyCap,
        {
          keyData: keyData,
          rowIndex: rowIndex,
          keyIndex: keyIndex,
          isPressed: isPressed,
          keySize: keySize,
          keyGap: keyGap,
          specialKeyboardColor: specialKeyboardColor,
          keyboardVariant: keyboardVariant,
          customKeycapImageMap: customKeycapImageMap,
          keyFont: keyFont,
          onMouseDown: () => {
            startTransition(() => {
              setPressedKeys((prev) => {
                const newSet = new Set(prev)
                newSet.add(keyData.key)
                return newSet
              })
            })
            if ((keyData.key === "MetaLeft" || keyData.key === "MetaRight") && props.specialKeyLink) {
              handleWindowsKeyClick()
              return
            }
            handleKeyClick(keyData)
          },
          onMouseUp: () => {
            startTransition(() => {
              setPressedKeys((prev) => {
                const newSet = new Set(prev)
                newSet.delete(keyData.key)
                return newSet
              })
            })
          },
          onMouseLeave: () => {
            startTransition(() => {
              setPressedKeys((prev) => {
                const newSet = new Set(prev)
                newSet.delete(keyData.key)
                return newSet
              })
            })
          },
        },
        `key-${rowIndex}-${keyIndex}`,
      )
    },
    [
      pressedKeys,
      keyboardVariant,
      specialKeyboardColor,
      customKeycapImageMap,
      keyFont,
      props.specialKeyLink,
      handleWindowsKeyClick,
      handleKeyClick,
      keySize,
      keyGap,
    ],
  )

  // Memoize the entire keyboard layout rendering
  const renderedKeyboard = useMemo(
    () =>
      /*#__PURE__*/ _jsx("div", {
      style: { ...keyboardBaseStyle, backgroundColor: keyboardColor, gap: `${keyGap * 2}px` },
      children: keyboardLayout.map((row, rowIndex) =>
          /*#__PURE__*/ _jsx(
        "div",
        {
          style: { display: "flex", gap: `${keyGap}px` },
          children: row.map((keyData, keyIndex) => renderKey(keyData, rowIndex, keyIndex)),
        },
        `row-${rowIndex}`,
      ),
      ),
    }),
    [keyboardLayout, keyboardColor, keyGap, renderKey],
  )

  // ---- Practice display ----
  const practiceDisplay = useMemo(() => {
    if (!showTextPreview) return null

    if (!currentSentence) {
      return /*#__PURE__*/ _jsx("div", {
        style: { ...practicePanelStyle, color: textColor },
        children: /*#__PURE__*/ _jsxs("div", {
          style: { width: "100%", textAlign: "center", opacity: 0.85, fontSize: "15px" },
          children: [
            /*#__PURE__*/ _jsx("div", {
            style: { marginBottom: "10px", fontWeight: 600, letterSpacing: "0.5px" },
            children: "Cybersecurity Typing Practice",
          }),
            /*#__PURE__*/ _jsx("div", {
            style: { opacity: 0.7, fontSize: "13px" },
            children: statusMessage || "Loading sentences...",
          }),
          ],
        }),
      })
    }

    const sentence = currentSentence.text
    const arabic = currentSentence.ar

    // Three intensities of the SAME white. Nothing else changes per-char.
    // No backgrounds, no padding swaps, no separate cursor element that
    // could push characters around. Only the colour deepens as you type.
    const DIM = "rgba(255, 255, 255, 0.28)"
    const STRONG = "rgba(255, 255, 255, 1)"
    const ERROR = "#ff6b6b"
    const cursorColor = showCursor
      ? "rgba(255, 255, 255, 0.85)"
      : "rgba(255, 255, 255, 0.18)"

    const charNodes: any[] = []
    for (let i = 0; i < sentence.length; i++) {
      const ch = sentence[i]
      const typed = i < typedText.length ? typedText[i] : undefined
      const isCursor = i === typedText.length

      let color: string
      if (typed === undefined) {
        color = DIM
      } else if (typed === ch) {
        color = STRONG
      } else {
        color = ERROR
      }

      // border-bottom is ALWAYS 2px (transparent when no cursor) so the
      // line never reflows vertically when the cursor moves.
      const underline = isCursor ? cursorColor : "transparent"

      charNodes.push(
        /*#__PURE__*/ _jsx(
        "span",
        {
          style: {
            color,
            display: "inline-block",
            borderBottom: `2px solid ${underline}`,
            transition: "color 0.12s ease, border-bottom-color 0.12s ease",
            whiteSpace: "pre",
            padding: "1px 0",
          },
          children: ch === " " ? " " : ch,
        },
        `c-${i}`,
      ),
      )
    }

    return /*#__PURE__*/ _jsxs("div", {
      style: { ...practicePanelStyle, color: textColor },
      children: [
        /*#__PURE__*/ _jsxs("div", {
        style: {
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          letterSpacing: "1px",
          textTransform: "uppercase",
          opacity: 0.55,
          marginBottom: "14px",
        },
        children: [
            /*#__PURE__*/ _jsx("span", { children: "Cybersecurity Typing Practice" }),
            /*#__PURE__*/ _jsxs("span", {
          children: [
            "Completed ",
            completedCount,
            "  ·  Queue ",
            Math.min(TARGET_QUEUE_SIZE, sentenceQueue.length + 1),
            "/",
            TARGET_QUEUE_SIZE,
          ],
        }),
        ],
      }),
        /*#__PURE__*/ _jsx("div", {
        key: `ar-${completedCount}`,
        style: {
          width: "100%",
          fontFamily: "'Cairo', 'Tajawal', 'Segoe UI', system-ui, sans-serif",
          fontSize: "19px",
          fontWeight: 500,
          lineHeight: "36px",
          color: "rgba(255, 255, 255, 0.72)",
          direction: "rtl",
          textAlign: "right",
          marginBottom: "10px",
          animation: "kbFadeIn 0.22s ease forwards",
          // Make sure dots/punctuation render on the correct side.
          unicodeBidi: "isolate",
        },
        // Pronunciation guide — NOT a translation. Reads how the English is pronounced.
        children: arabic,
      }),
        /*#__PURE__*/ _jsx("div", {
        style: {
          width: "100%",
          height: "1px",
          backgroundColor: "rgba(255, 255, 255, 0.06)",
          marginBottom: "12px",
        },
      }),
        /*#__PURE__*/ _jsx("div", {
        key: `en-${completedCount}`,
        style: {
          width: "100%",
          fontFamily: "'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "22px",
          lineHeight: "40px",
          letterSpacing: "1px",
          animation: "kbFadeIn 0.22s ease forwards",
          wordBreak: "normal",
          overflowWrap: "anywhere",
          textAlign: "left",
        },
        children: /*#__PURE__*/ _jsx(_Fragment, { children: charNodes }),
      }),
      ],
    })
  }, [
    showTextPreview,
    isInitializing,
    statusMessage,
    currentSentence,
    typedText,
    textColor,
    showCursor,
    completedCount,
    sentenceQueue.length,
  ])

  return /*#__PURE__*/ _jsxs("div", {
    ref: containerRef,
    style: {
      ...containerBaseStyle,
      backgroundColor: transparentBackground ? "transparent" : backgroundColor,
      ...props.style,
    },
    children: [
      practiceDisplay,
      renderedKeyboard,
      /*#__PURE__*/ _jsx("style", {
        children: "@keyframes kbFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}",
      }),
      /*#__PURE__*/ _jsx("link", {
        href: "https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Cairo:wght@400;500;600&display=swap",
        rel: "stylesheet",
      }),
    ],
  })
}

// Helper function to adjust color brightness
function adjustColor(color, amount) {
  color = color.replace(/^#/, "")
  let r = Number.parseInt(color.substring(0, 2), 16)
  let g = Number.parseInt(color.substring(2, 4), 16)
  let b = Number.parseInt(color.substring(4, 6), 16)
  r = Math.max(0, Math.min(255, r + amount))
  g = Math.max(0, Math.min(255, g + amount))
  b = Math.max(0, Math.min(255, b + amount))
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

addPropertyControls(MechanicalKeyboard, {
  keyboardVariant: {
    type: ControlType.Enum,
    title: "Keyboard Type",
    options: ["regular", "apple", "mobile"],
    optionTitles: ["Regular", "Apple", "Mobile"],
    defaultValue: "regular",
    displaySegmentedControl: true,
  },
  specialKeyboardColor: {
    type: ControlType.Color,
    title: "Special Key Color",
    defaultValue: "#C0C0C0",
    hidden: ({ keyboardVariant }) => keyboardVariant !== "regular",
  },
  showTextPreview: {
    type: ControlType.Boolean,
    title: "Text Preview",
    defaultValue: true,
    enabledTitle: "Show",
    disabledTitle: "Hide",
  },
  keyboardColor: { type: ControlType.Color, title: "Keyboard Color", defaultValue: "#2a2a2a" },
  textColor: { type: ControlType.Color, title: "Text Color", defaultValue: "#ffffff" },
  backgroundColor: { type: ControlType.Color, title: "Background", defaultValue: "#121212" },
  transparentBackground: { type: ControlType.Boolean, title: "Transparent BG", defaultValue: false },
  specialKeyLink: { type: ControlType.Link, title: "Special Key Link", defaultValue: "" },
  keyFont: {
    type: ControlType.Font,
    title: "Key Font",
    defaultValue: { fontSize: "14px", fontWeight: 700, fontFamily: "Helvetica, Arial, sans-serif" },
    controls: "extended",
    defaultFontType: "sans-serif",
  },
  windowsKeyImage: { type: ControlType.ResponsiveImage, title: "Special Key" },
  appleKeyImage: {
    type: ControlType.ResponsiveImage,
    title: "Apple Key",
    hidden: ({ keyboardVariant }) => keyboardVariant !== "apple",
  },
  customKeycapImages: {
    type: ControlType.Array,
    title: "Custom Keycaps",
    control: {
      type: ControlType.Object,
      controls: {
        key: { type: ControlType.String, title: "Key", defaultValue: "a", placeholder: "Enter key (a, b, 1, etc.)" },
        image: { type: ControlType.ResponsiveImage, title: "Image" },
      },
    },
    defaultValue: [],
  },
  keyRemappings: {
    type: ControlType.Array,
    title: "Key Remappings",
    control: {
      type: ControlType.Object,
      controls: {
        originalKey: {
          type: ControlType.String,
          title: "Original Key",
          defaultValue: "a",
          placeholder: "Enter key (a, b, 1, etc.)",
        },
        remappedTo: {
          type: ControlType.String,
          title: "Remap To",
          defaultValue: "z",
          placeholder: "Enter character or function",
        },
      },
    },
    defaultValue: [],
  },
})

// Move static styles outside component to prevent recreation
const containerBaseStyle = {
  position: "relative",
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  borderRadius: "12px",
  boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.1)",
  overflow: "hidden",
}

// New: practice panel replaces the free-typing preview.
const practicePanelStyle: any = {
  width: "85%",
  minHeight: "120px",
  backgroundColor: "#181818",
  borderRadius: "10px",
  padding: "18px 22px",
  marginBottom: "22px",
  boxShadow:
    "0 2px 12px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.04)",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
}

const keyboardBaseStyle = {
  borderRadius: "8px",
  padding: "15px",
  boxShadow: `
        0 2px 0 #1a1a1a,
        0 3px 0 #151515,
        0 4px 0 #101010,
        inset 0 1px 1px rgba(255, 255, 255, 0.1)
    `,
  display: "flex",
  flexDirection: "column",
}

// Memoized Key component to prevent unnecessary re-renders
const KeyCap = /*#__PURE__*/ memo(
  ({
    keyData,
    rowIndex,
    keyIndex,
    isPressed,
    keySize,
    keyGap,
    specialKeyboardColor,
    keyboardVariant,
    customKeycapImageMap,
    keyFont,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
  }) => {
    const isSpecial = keyData.isSpecial && keyboardVariant === "regular"
    const isActive = keyData.active
    const keyBaseColor = "#f5f5f5"
    const keyBottomColor = "#e0e0e0"
    const useSpecialColor = isSpecial
    return /*#__PURE__*/ _jsxs("div", {
      style: {
        width: `${keyData.width * keySize + (keyData.width - 1) * keyGap}px`,
        height: keyData.height ? `${keyData.height * keySize + (keyData.height - 1) * keyGap}px` : `${keySize}px`,
        borderRadius: "4px",
        background: useSpecialColor
          ? specialKeyboardColor
          : `linear-gradient(to bottom, ${keyBaseColor}, ${keyBottomColor})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Arial', sans-serif",
        fontSize: "14px",
        fontWeight: "bold",
        color: useSpecialColor ? "#ffffff" : "#333",
        cursor: "pointer",
        userSelect: "none",
        boxShadow: isPressed
          ? `
                        0 1px 1px rgba(0, 0, 0, 0.3),
                        inset 0 1px 3px rgba(0, 0, 0, 0.2)
                    `
          : `
                        0 2px 0 #bbb,
                        0 3px 2px rgba(0, 0, 0, 0.2),
                        0 4px 3px rgba(0, 0, 0, 0.1),
                        0 5px 4px rgba(0, 0, 0, 0.05),
                        inset 0 -1px 1px rgba(0, 0, 0, 0.1),
                        inset 0 1px 1px rgba(255, 255, 255, 0.6)
                    `,
        transform: isPressed ? "translateY(2px) scale(0.98)" : "translateY(0) scale(1)",
        transition: "transform 0.1s ease, box-shadow 0.1s ease",
        position: "relative",
        overflow: "hidden",
      },
      onMouseDown: onMouseDown,
      onMouseUp: onMouseUp,
      onMouseLeave: onMouseLeave,
      children: [
        /*#__PURE__*/ _jsx("div", {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: "4px",
          boxShadow: "inset 0 6px 3px rgba(255, 255, 255, 0.4), inset 0 -1px 3px rgba(0, 0, 0, 0.15)",
          pointerEvents: "none",
        },
      }),
        /*#__PURE__*/ _jsx("span", {
        style: {
          display: "inline-block",
          transform: isPressed ? "translateY(1px)" : "translateY(0)",
          transition: "transform 0.1s ease",
          fontFamily: keyFont?.fontFamily || "Helvetica, Arial, sans-serif",
          fontSize: keyFont?.fontSize || "14px",
          fontWeight: keyFont?.fontWeight || "bold",
          letterSpacing: keyFont?.letterSpacing,
          lineHeight: keyFont?.lineHeight,
          fontStyle: keyFont?.fontStyle,
        },
        children: customKeycapImageMap[keyData.key]
          ? /*#__PURE__*/ _jsx("img", {
            src: customKeycapImageMap[keyData.key].src,
            alt: customKeycapImageMap[keyData.key].alt || keyData.label.toString(),
            style: { width: "24px", height: "24px", objectFit: "contain" },
          })
          : keyData.label,
      }),
        isActive &&
          /*#__PURE__*/ _jsx("div", {
          style: {
            position: "absolute",
            top: "5px",
            right: "5px",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "#fff",
            boxShadow: "0 0 3px rgba(255, 255, 255, 0.8)",
          },
        }),
      ],
    })
  },
)
KeyCap.displayName = "KeyCap"

export const __FramerMetadata__ = {
  exports: {
    default: {
      type: "reactComponent",
      name: "MechanicalKeyboard",
      slots: [],
      annotations: {
        framerSupportedLayoutHeight: "fixed",
        framerContractVersion: "1",
        framerSupportedLayoutWidth: "fixed",
      },
    },
    __FramerMetadata__: { type: "variable" },
  },
}
//# sourceMappingURL=./MechanicalKeyboard.map
