# AdSense and Rewarded Ad Setup

This game includes AdSense site verification plus a rewarded-ad hook for Google Ad Manager rewarded ads on web.

Official docs:

- https://support.google.com/adsense/answer/7584263
- https://support.google.com/adsense/answer/12726063
- https://support.google.com/admanager/answer/9116812
- https://support.google.com/admanager/answer/7386053

## Current status

- The AdSense site verification meta tag is installed in `index.html`.
- `ads.txt` is installed at the site root.
- The game code is ready for Google Ad Manager rewarded web ads, but the ad unit path is intentionally blank.
- While the Ad Manager path is blank, the `광고보기` button grants a test coin and explains the missing production setup.

## What to prepare

1. Create or use a Google Ad Manager account.
2. Create a web rewarded ad unit.
3. Traffic rewarded web demand for that ad unit.
4. Copy the full ad unit path, for example:

```js
"/1234567/green-leaf-lucky-girl/rewarded"
```

## Where to put it

Open `game.js` and replace the empty value:

```js
const REWARDED_AD_UNIT_PATH = "";
```

with your real Google Ad Manager ad unit path:

```js
const REWARDED_AD_UNIT_PATH = "/1234567/green-leaf-lucky-girl/rewarded";
```

## Runtime behavior

- The player taps `광고보기`.
- Google Publisher Tag requests a rewarded ad.
- When Google fires `rewardedSlotGranted`, the game grants 1 coin.
- The player can spend 1 coin on `자석` to pull green leaves toward the basket for 12 seconds.

Without `REWARDED_AD_UNIT_PATH`, the button is a test reward only. It does not show a real ad.

## Why AdSense still is not enough for game coins

AdSense can verify and monetize the site, and AdSense Offerwall can show a rewarded ad choice for content access. It does not provide this game with a direct JavaScript callback for "the player finished an ad, now grant 1 coin."

For button-based in-game coin rewards, use Google Ad Manager rewarded web ads and set `REWARDED_AD_UNIT_PATH`.

## Policy note

Do not let Auto ads appear on empty overlays, alerts, loading-only screens, or game-only transition screens. Google-served ads need to be associated with real publisher content. This site now includes visible gameplay guide content below the game so the page has crawlable, user-facing content, but Auto ads should still be reviewed in AdSense preview and excluded from places that cover or interrupt the game.
