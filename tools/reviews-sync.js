#!/usr/bin/env node
/**
 * Sonty reviews-daemon — houdt Google-reviews + aantallen op de site actueel.
 *
 * Gebruikt de Google Places API (New). Vereist:
 *   ~/sonty/secrets/google-places-key.txt  → de API-key
 *   ~/sonty/secrets/google-place-id.txt    → het Place ID (optioneel; default Sonty BV)
 *
 * Haalt rating, totaal-aantal en de nieuwste reviews op, merge't ze met de
 * bestaande reviewpool in data/google-reviews-seed.json (zo groeit de pool
 * voor de relevantie-filtering op productpagina's), en pusht alleen bij
 * wijzigingen — GitHub Actions deployt dan automatisch.
 *
 * Draait dagelijks via cron. Fouten → Telegram.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const HOME = process.env.HOME;
const SITE = path.join(HOME, "sonty-website");
const SEED = path.join(SITE, "data", "google-reviews-seed.json");
const KEY_FILE = path.join(HOME, "sonty", "secrets", "google-places-key.txt");
const PLACE_FILE = path.join(HOME, "sonty", "secrets", "google-place-id.txt");
const MELD_FILE = "/tmp/sonty-reviews-key-gemeld";
const TG = "8638107367:AAGZMmR_e6JJRkneZAJgBdGNEM8BVQFma40";

async function telegram(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: 1700128390, text }),
    });
  } catch {}
}

(async () => {
  try {
    if (!fs.existsSync(KEY_FILE)) {
      // Eén keer melden, daarna stil overslaan tot de key er is
      if (!fs.existsSync(MELD_FILE)) {
        fs.writeFileSync(MELD_FILE, "1");
        await telegram("ℹ️ Reviews-daemon staat klaar maar wacht op de Google Places API-key (zet hem in ~/sonty/secrets/google-places-key.txt of stuur hem via Telegram).");
      }
      console.log("geen API-key — overslaan");
      return;
    }
    const apiKey = fs.readFileSync(KEY_FILE, "utf8").trim();
    const placeId = fs.existsSync(PLACE_FILE)
      ? fs.readFileSync(PLACE_FILE, "utf8").trim()
      : "ChIJPVskiIixxUcRg99vGRpzL1s"; // Sonty BV (uit de maps-embed place-ID 0x47c5b188a8245b3d:0x5b2f073a19f6df83)

    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=nl`, {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "displayName,rating,userRatingCount,reviews" },
    });
    if (!res.ok) throw new Error(`Places API ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const data = await res.json();

    const rating = data.rating;
    const totaal = data.userRatingCount;
    if (!rating || !totaal) throw new Error("API gaf geen rating/aantal terug");

    const vers = (data.reviews || []).map((r) => ({
      author: r.authorAttribution?.displayName || "Anoniem",
      rating: r.rating || 5,
      text: r.text?.text || r.originalText?.text || "",
      relativeTime: r.relativePublishTimeDescription || "",
      profilePhoto: r.authorAttribution?.photoUri || undefined,
    })).filter((r) => r.text && r.text.length > 25);

    const huidig = JSON.parse(fs.readFileSync(SEED, "utf8"));
    // Merge: nieuwe reviews vooraan, bestaande pool behouden (dedup op tekst-begin)
    const bestaand = (huidig.reviews || []).filter(
      (oud) => !vers.some((n) => n.text.slice(0, 60) === oud.text?.slice(0, 60))
    );
    const pool = [...vers, ...bestaand].slice(0, 60);

    const zelfde = huidig.rating === rating && huidig.totalReviews === totaal
      && JSON.stringify((huidig.reviews || []).map((x) => x.text?.slice(0, 40)))
         === JSON.stringify(pool.map((x) => x.text?.slice(0, 40)));
    if (zelfde) { console.log("geen wijzigingen"); return; }

    fs.writeFileSync(SEED, JSON.stringify({ ...huidig, rating, totalReviews: totaal, reviews: pool, fetchedAt: new Date().toISOString() }, null, 2));
    execSync(`cd ${SITE} && git add data/google-reviews-seed.json && git -c user.name="Daimy Boot" -c user.email="daimyboot@gmail.com" commit -m "Reviews-sync: ${totaal} reviews, ${rating}/5 (automatisch)" && git push`, { stdio: "pipe" });
    console.log(`bijgewerkt: ${rating}/5, ${totaal} reviews, pool ${pool.length}`);
    await telegram(`⭐ Reviews-sync: ${rating}/5 met ${totaal} Google-reviews — site bijgewerkt en deploy loopt.`);
  } catch (e) {
    console.error("FOUT:", e.message);
    await telegram(`⚠️ Reviews-daemon fout: ${e.message.slice(0, 150)} — site draait door op de laatste goede data.`);
    process.exit(1);
  }
})();
