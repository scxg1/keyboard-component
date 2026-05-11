import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const API_KEY =
  process.env.GLM_API_KEY || "66ed2c440791407b92ae8f4350cf26e6.6c6zIfdhVNmfvvi5"
const API_URL =
  process.env.GLM_API_URL ||
  "https://open.bigmodel.cn/api/paas/v4/chat/completions"
const MODEL = process.env.GLM_MODEL || "GLM-5.1"

export type SentenceItem = { text: string; ar: string }

const SYSTEM_PROMPT = `You are generating cybersecurity typing-practice content for ARABIC-SPEAKING CHILDREN AND STUDENTS who are LEARNING English. Phonetic accuracy of the Arabic pronunciation guide is CRITICAL — any inaccuracy will teach the wrong pronunciation.

For EVERY item you produce, return TWO fields:
1. "text" — an English cybersecurity sentence (the typing target).
2. "ar"   — an ARABIC PHONETIC TRANSLITERATION showing HOW THE ENGLISH IS PRONOUNCED, using Arabic letters AND DIACRITICS. It is NOT a translation of meaning.

==============================
Rules for "text":
==============================
- Topic MUST be strictly cybersecurity (encryption, firewalls, phishing, malware, ransomware, network security, authentication, MFA, zero trust, vulnerabilities, ethical hacking, SOC, SIEM, threat intelligence, incident response, social engineering, OWASP, penetration testing, cryptography, digital forensics).
- Length: STRICTLY between 45 and 80 characters.
- Use ONLY ASCII letters, digits, spaces, and . , : ; - '
- NO quotes, parentheses, brackets, em dashes, ellipses, smart quotes, emojis.
- Each "text" must be unique and clearly distinct.
- Clear, professional English. Complete declarative statement ending with a period.

==============================
Rules for "ar" (PHONETIC TRANSLITERATION):
==============================
- It maps English SOUNDS to Arabic letters. NOT a translation.
- Preserve English word order; one Arabic cluster per English word.
- Use ONLY: Arabic letters (ء-ي), Arabic diacritics (fatha ـَ, kasra ـِ, damma ـُ, sukoon ـْ, shadda ـّ, tanween), spaces, and an optional final period.
- NO Latin letters, NO digits, NO non-Arabic letters (no Persian چ پ ژ گ, no Urdu letters).
- USE DIACRITICS when the bare letters would be ambiguous to a CHILD reader.

==============================
ACCURACY RULES — these are common MISTAKES; do NOT make them:
==============================
- "of"          ->  "أَف"        (NOT "أوف" — "أوف" reads as "oof", but "of" sounds like "uhv/uhf")
- "Multi"       ->  "مَلتي"      (NOT bare "ملتي" — could be misread as "milti")
- "the"         ->  "ذَ" or "ذِ"  (NOT "ذا" with long alif unless followed by stressed vowel)
- "layer"       ->  "لِيَر"       (NOT "لاير" — "لاير" reads as "laa-yer"; the correct sound is "LAY-er")
- "layers"      ->  "لِيَرز"
- "phishing"    ->  "فِشِنغ"     (NOT "فيشينغ" — "فيشينغ" reads as "feeshing" with long ee)
- "ransomware"  ->  "رانْسَم وير" (NOT "رانسوم وير" — "رانسوم" reads as "ransoom")
- "ransom"      ->  "رانْسَم"
- "password"    ->  "باسْوَرد"   (NOT "باسوُورد" — "وُورد" reads as "wuurd"; should be "وَرد")
- "passwords"   ->  "باسْوَردز"
- "risk"        ->  "رِسك"       (NOT "ريسك" — "ريسك" reads as "reesk")
- "with"        ->  "وِذ"        (with kasra)
- "trust"       ->  "تْرَست"      (NOT "تراست" with long alif)
- "trusted"     ->  "تْرَستِد"
- "encrypt"     ->  "إنكْرِبت"
- "encrypts"    ->  "إنكْرِبتس"
- "encryption"  ->  "إنكْرِبشَن"
- "encrypting"  ->  "إنكْرِبتِنغ"
- "credentials" ->  "كْرِدِنشَلز"
- "authentication" -> "أُوثِنتيكِيشَن"
- "vulnerability"  -> "فُلنَرابيلِتي"
- "vulnerabilities" -> "فُلنَرابيلِتيز"
- "and"         ->  "آند"
- "is"          ->  "إز"
- "in"          ->  "إن"
- "to"          ->  "تو"
- "a"           ->  "أَ"
- "an"          ->  "أَن"
- "for"         ->  "فور"
- "by"          ->  "باي"
- "from"        ->  "فْرَم"
- "they"        ->  "ذِيْ"
- "are"         ->  "آر"
- "be"          ->  "بي"
- "key"         ->  "كي"
- "data"        ->  "داتا"
- "files"       ->  "فايلز"
- "network"     ->  "نِتوَرك"
- "networks"    ->  "نِتوَركس"
- "security"    ->  "سيكْيُورِتي"
- "secure"      ->  "سيكْيُور"
- "user"        ->  "يُوزَر"
- "users"       ->  "يُوزَرز"
- "device"      ->  "دِفايس"
- "devices"     ->  "دِفايسِز"
- "attack"      ->  "أَتَك"
- "attacker"    ->  "أَتَكَر"
- "attackers"   ->  "أَتَكَرز"
- "malware"     ->  "مالوير"
- "firewall"    ->  "فاير وول"
- "zero trust"  ->  "زيرو تْرَست"
- "session"     ->  "سِشَن"
- "sessions"    ->  "سِشَنز"
- "patching"    ->  "باتشِنغ"
- "system"      ->  "سِستِم"
- "systems"     ->  "سِستِمز"
- "policy"      ->  "بوليسي"
- "policies"    ->  "بوليسيز"
- "factor"      ->  "فَكْتَر"
- "factors"     ->  "فَكْتَرز"
- "safe"        ->  "سَيف"
- "safety"      ->  "سَيفتي"
- "say"         ->  "سَي"
- "day"         ->  "دَي"
- "way"         ->  "وَي"
- "account"     ->  "أَكاوْنت"
- "accounts"    ->  "أَكاوْنتس"
- "out"         ->  "أَوْت"
- "power"       ->  "باوَر"
- "now"         ->  "ناوْ"
- "keeps"       ->  "كيبس"
- "keep"        ->  "كيب"
- "adds"        ->  "أَدز"

==============================
DIPHTHONG & FINAL-VOWEL RULES — APPLY STRICTLY:
==============================
These three error patterns are FORBIDDEN. Children read literally; getting these wrong teaches the wrong sound.

RULE 1 — Final unstressed "-er / -or / -ar" (the English schwa /ər/):
   ALWAYS end with FATHA ـَ on the final consonant. NEVER damma ـُ.
   Examples:
     factor    -> "فَكْتَر"    NOT "فَكْتُر"   (damma turns it into "FAK-toor")
     user      -> "يُوزَر"     NOT "يُوزُر"
     attacker  -> "أَتَكَر"    NOT "أَتَكُر"
     monitor   -> "مونِتَر"    NOT "مونِتُر"
     paper     -> "بيبَر"      NOT "بيبُر"
     filter    -> "فِلتَر"     NOT "فِلتُر"

RULE 2 — Diphthong /eɪ/ (the "ay" sound in "safe, say, day, may, name, layer, pay"):
   ALWAYS use FATHA ـَ + ي (yaa). NEVER kasra ـِ on a yaa, NEVER long alif ا.
   The correct Arabic shape is the same as the word "سَيف" (sword).
   Examples:
     safe   -> "سَيف"   NOT "سيِف"  NOT "سايف"  NOT "سيف"
     say    -> "سَي"    NOT "سيِ"
     name   -> "نَيم"   NOT "نيم"   NOT "نايم"
     pay    -> "بَي"
     layer  -> "لِيَر"  (this one is closer to /ˈleɪər/ with stress shift; keep as listed)

RULE 3 — Diphthong /aʊ/ (the "ow / ou" sound in "account, out, now, power, how"):
   ALWAYS use FATHA ـَ + ا + و-with-SUKOON ـْ. NEVER damma on the waw.
   The waw is the SECOND HALF of the diphthong, NOT a long "oo" vowel.
   Examples:
     account  -> "أَكاوْنت"   NOT "أَكاوُنت"   NOT "أَكاونتس"
     accounts -> "أَكاوْنتس"  NOT "أَكاوُنتس"
     out      -> "أَوْت"      NOT "أُوت"       NOT "أَوُت"
     power    -> "باوَر"       (here the second syllable is just schwa "َر")
     now      -> "ناوْ"
     how      -> "هاوْ"

GENERAL PRINCIPLES (apply these even for words not listed above):
- Short English "i" (as in "risk", "in", "is") -> Arabic kasra ـِ (NEVER long ي unless the English vowel is the "ee" sound).
- Short English "u" (as in "Multi", "up", "but") -> Arabic fatha ـَ (NOT long ا/و).
- Short English "a" (as in "and", "have", "cat", "attack") -> "أَ" with fatha; NEVER long ا (so "attack" is "أَتَك", NOT "أتاك").
- The English "of" / "uhv" sound -> "أَف"; NEVER "أوف" (which means "oof").
- Voiced "th" (as in "the", "this", "that") -> "ذ"; voiceless "th" (as in "think", "threat") -> "ث".
- Final consonants that need a clear pronunciation -> add sukoon ـْ.

The transliteration is read aloud by CHILDREN; if a literal reading would mispronounce the English, the transliteration is WRONG. Before emitting each word, mentally read it aloud as written and confirm it produces the correct English sound.

==============================
Output format
==============================
Reply with ONLY a valid JSON array of objects. No markdown, no code fences, no commentary. Example:
[{"text":"Ransomware encrypts files and demands a payment.","ar":"رانْسَم وير إنكْرِبتس فايلز آند دِماندز أَ بايمَنت."},{"text":"Firewalls block traffic from untrusted networks.","ar":"فاير وولز بلَك تْرافِك فْرَم أَنتْرَستِد نِتوُركس."}]`

const ARABIC_RANGE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g

function extractJsonArray(raw: string): unknown[] {
  if (!raw) return []
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1] : raw
  const match = body.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[0])
    if (Array.isArray(parsed)) return parsed
  } catch {
    // fall through
  }
  return []
}

function sanitizeEnglish(input: string): string {
  return input
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
}

function sanitizeArabic(input: string): string {
  return input
    // Strip directional and zero-width marks that may sneak in.
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function isAcceptable(item: SentenceItem): boolean {
  if (typeof item.text !== "string" || typeof item.ar !== "string") return false
  // English target
  if (item.text.length < 35 || item.text.length > 95) return false
  if (!/^[\x20-\x7E]+$/.test(item.text)) return false
  // Arabic transliteration — must be predominantly Arabic letters.
  const arNoSpace = item.ar.replace(/\s/g, "")
  if (arNoSpace.length < 8) return false
  const arabicCount = (item.ar.match(ARABIC_RANGE) || []).length
  if (arabicCount / arNoSpace.length < 0.6) return false
  // Reject if it contains Latin letters or digits — that means the model
  // mixed languages instead of transliterating.
  if (/[A-Za-z0-9]/.test(item.ar)) return false
  return true
}

export async function POST(request: Request) {
  let body: { count?: number; excludeList?: string[] }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const count = Math.max(1, Math.min(20, body.count ?? 1))
  const excludeList = Array.isArray(body.excludeList) ? body.excludeList : []

  const exclusionBlock =
    excludeList.length > 0
      ? `\n\nIMPORTANT: The following English sentences have ALREADY been shown to the user. You MUST NOT repeat any of them or anything substantially similar. Vary subject and wording:\n${excludeList
          .slice(-60)
          .map((s, i) => `${i + 1}. ${s}`)
          .join("\n")}`
      : ""

  const userPrompt = `Generate ${count} unique cybersecurity item${
    count > 1 ? "s" : ""
  } for Arabic-speaking children/students learning English.${exclusionBlock}\n\nReturn ONLY the JSON array of ${count} object${
    count > 1 ? "s" : ""
  } with {"text","ar"} fields. The "ar" pronunciation MUST be phonetically accurate with diacritics — children will read it aloud.`

  try {
    const apiRes = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        top_p: 0.9,
        stream: false,
      }),
    })

    if (!apiRes.ok) {
      const errText = await apiRes.text().catch(() => "")
      return NextResponse.json(
        {
          sentences: [],
          error: `Upstream ${apiRes.status}: ${errText.slice(0, 300)}`,
        },
        { status: 200 },
      )
    }

    const data = await apiRes.json()
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.delta?.content ??
      ""

    const seen = new Set(excludeList.map((s) => s.toLowerCase().trim()))
    const raw = extractJsonArray(content)

    const sentences: SentenceItem[] = []
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue
      const e = entry as Record<string, unknown>
      const text = typeof e.text === "string" ? sanitizeEnglish(e.text) : ""
      const ar = typeof e.ar === "string" ? sanitizeArabic(e.ar) : ""
      const item: SentenceItem = { text, ar }
      if (!isAcceptable(item)) continue
      const key = text.toLowerCase().trim()
      if (seen.has(key)) continue
      seen.add(key)
      sentences.push(item)
    }

    return NextResponse.json({ sentences })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { sentences: [], error: message },
      { status: 200 },
    )
  }
}
