# Rewarded Ad Setup

This game includes a rewarded-ad hook for Google Ad Manager rewarded ads on web.

Official docs:

- https://support.google.com/admanager/answer/9116812
- https://support.google.com/admanager/answer/7386053

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

Without `REWARDED_AD_UNIT_PATH`, the button only shows a setup message and does not grant coins.
