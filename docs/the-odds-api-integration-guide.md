# The Odds API — NCAAB Integration Guide

## March Madness Survivor Pool Application

---

## 1. API Overview

**The Odds API** provides live and historical sports odds from bookmakers worldwide via a simple REST/JSON interface.

- **Base URL:** `https://api.the-odds-api.com`
- **IPv6 Alternative:** `https://ipv6-api.the-odds-api.com`
- **API Version:** v4
- **Auth Method:** API key passed as a query parameter (`apiKey`)
- **Response Format:** JSON
- **NCAAB Sport Key:** `basketball_ncaab`

---

## 2. Key Endpoints for Our Application

We need three endpoints:

| Endpoint | Purpose | Quota Cost |
|----------|---------|------------|
| `GET /v4/sports/` | List available sports (confirm NCAAB is in-season) | **Free** (no quota) |
| `GET /v4/sports/{sport}/odds/` | Get odds (spreads, moneyline) for upcoming/live games | 1 per region × per market |
| `GET /v4/sports/{sport}/scores/` | Get scores and game results | 1 (live only) or 2 (with `daysFrom`) |
| `GET /v4/sports/{sport}/events/` | List events with IDs (no odds) | **Free** (no quota) |

---

## 3. API Request Formats

### 3.1 Check If NCAAB Is In-Season

```
GET https://api.the-odds-api.com/v4/sports/?apiKey=YOUR_API_KEY
```

Look for the object where `"key": "basketball_ncaab"` and `"active": true`.

### 3.2 Get NCAAB Odds (Spreads + Moneyline)

```
GET https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds/?apiKey=YOUR_API_KEY&regions=us&markets=h2h,spreads&oddsFormat=american&dateFormat=iso
```

**Parameters:**

| Parameter | Value | Notes |
|-----------|-------|-------|
| `sport` | `basketball_ncaab` | In the URL path |
| `apiKey` | Your API key | Required |
| `regions` | `us` | US bookmakers (DraftKings, FanDuel, BetMGM, etc.) |
| `markets` | `h2h,spreads` | `h2h` = moneyline, `spreads` = point spread |
| `oddsFormat` | `american` | American odds format (+150, -200). Also supports `decimal` |
| `dateFormat` | `iso` | ISO 8601 timestamps (default). Also supports `unix` |
| `bookmakers` | *(optional)* | Filter to specific books, e.g. `draftkings,fanduel` |
| `commenceTimeFrom` | *(optional)* | ISO 8601 filter, e.g. `2026-03-15T00:00:00Z` |
| `commenceTimeTo` | *(optional)* | ISO 8601 filter for end date |
| `eventIds` | *(optional)* | Comma-separated 32-char event IDs |

**Quota cost for this request:** 2 (1 region × 2 markets)

### 3.3 Get NCAAB Scores and Results

```
GET https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores/?apiKey=YOUR_API_KEY&daysFrom=3&dateFormat=iso
```

**Parameters:**

| Parameter | Value | Notes |
|-----------|-------|-------|
| `sport` | `basketball_ncaab` | In the URL path |
| `apiKey` | Your API key | Required |
| `daysFrom` | `1`, `2`, or `3` | Returns completed games from up to N days ago. Omit for live/upcoming only |
| `dateFormat` | `iso` | ISO 8601 timestamps |
| `eventIds` | *(optional)* | Filter to specific events |

**Quota cost:** 2 with `daysFrom`, 1 without.

### 3.4 List Events (Free — No Quota)

```
GET https://api.the-odds-api.com/v4/sports/basketball_ncaab/events/?apiKey=YOUR_API_KEY&dateFormat=iso
```

Use this to get event IDs for filtering other requests. This does **not** count against your quota.

---

## 4. Response Formats and Parsing

### 4.1 Odds Response Structure

```json
[
  {
    "id": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    "sport_key": "basketball_ncaab",
    "sport_title": "NCAAB",
    "commence_time": "2026-03-20T18:00:00Z",
    "home_team": "Duke Blue Devils",
    "away_team": "North Carolina Tar Heels",
    "bookmakers": [
      {
        "key": "draftkings",
        "title": "DraftKings",
        "last_update": "2026-03-20T15:30:00Z",
        "markets": [
          {
            "key": "h2h",
            "last_update": "2026-03-20T15:30:00Z",
            "outcomes": [
              { "name": "Duke Blue Devils", "price": -180 },
              { "name": "North Carolina Tar Heels", "price": 150 }
            ]
          },
          {
            "key": "spreads",
            "last_update": "2026-03-20T15:30:00Z",
            "outcomes": [
              { "name": "Duke Blue Devils", "price": -110, "point": -4.5 },
              { "name": "North Carolina Tar Heels", "price": -110, "point": 4.5 }
            ]
          }
        ]
      },
      {
        "key": "fanduel",
        "title": "FanDuel",
        "last_update": "2026-03-20T15:25:00Z",
        "markets": [
          {
            "key": "h2h",
            "last_update": "2026-03-20T15:25:00Z",
            "outcomes": [
              { "name": "Duke Blue Devils", "price": -175 },
              { "name": "North Carolina Tar Heels", "price": 145 }
            ]
          }
        ]
      }
    ]
  }
]
```

**Key fields:**

- `id` — 32-character unique event identifier
- `commence_time` — game start time (ISO 8601)
- `home_team` / `away_team` — team names
- `bookmakers[].markets[].key` — `"h2h"` for moneyline, `"spreads"` for point spread
- `outcomes[].name` — team name (matches `home_team` or `away_team`)
- `outcomes[].price` — the odds value (American format when requested)
- `outcomes[].point` — the spread value (only present for `spreads` market)

### 4.2 Scores Response Structure

```json
[
  {
    "id": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    "sport_key": "basketball_ncaab",
    "sport_title": "NCAAB",
    "commence_time": "2026-03-19T18:00:00Z",
    "completed": true,
    "home_team": "Duke Blue Devils",
    "away_team": "North Carolina Tar Heels",
    "scores": [
      { "name": "Duke Blue Devils", "score": "78" },
      { "name": "North Carolina Tar Heels", "score": "72" }
    ],
    "last_update": "2026-03-19T20:15:00Z"
  },
  {
    "id": "f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4",
    "sport_key": "basketball_ncaab",
    "sport_title": "NCAAB",
    "commence_time": "2026-03-21T20:00:00Z",
    "completed": false,
    "home_team": "Kansas Jayhawks",
    "away_team": "Gonzaga Bulldogs",
    "scores": null,
    "last_update": null
  }
]
```

**Key fields:**

- `completed` — `true` if game is final, `false` if upcoming or in-progress
- `scores` — array of `{name, score}` objects. `null` if game hasn't started. Scores are strings.
- `last_update` — when scores were last refreshed. `null` if not started.

**Determining game state:**
- `scores == null` → game hasn't started yet
- `scores != null && completed == false` → game is live (updates ~every 30 seconds)
- `scores != null && completed == true` → game is final

### 4.3 Response Headers (Quota Tracking)

Every API response includes these headers:

| Header | Description |
|--------|-------------|
| `x-requests-remaining` | Requests left until quota resets |
| `x-requests-used` | Requests used since last reset |

---

## 5. Production-Ready Python Code

### 5.1 Installation

```bash
pip install requests
```

### 5.2 Complete Client Module

```python
"""
the_odds_api.py — Client for The Odds API (v4)
Designed for NCAAB March Madness Survivor Pool integration.
"""

import requests
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

BASE_URL = "https://api.the-odds-api.com/v4"
SPORT = "basketball_ncaab"


class OddsAPIError(Exception):
    """Custom exception for Odds API errors."""
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"HTTP {status_code}: {message}")


class OddsAPIClient:
    """
    Client for The Odds API v4.
    
    Usage:
        client = OddsAPIClient(api_key="your_key_here")
        odds = client.get_ncaab_odds(markets=["h2h", "spreads"])
        scores = client.get_ncaab_scores(days_from=3)
    """

    def __init__(self, api_key: str, max_retries: int = 3, retry_delay: float = 2.0):
        self.api_key = api_key
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.session = requests.Session()
        self.requests_remaining: Optional[int] = None
        self.requests_used: Optional[int] = None

    def _request(self, endpoint: str, params: dict) -> list | dict:
        """
        Make an authenticated request with retry logic for rate limits.
        """
        params["apiKey"] = self.api_key
        url = f"{BASE_URL}/{endpoint}"

        for attempt in range(self.max_retries):
            try:
                response = self.session.get(url, params=params, timeout=30)

                # Track quota usage from response headers
                self.requests_remaining = response.headers.get("x-requests-remaining")
                self.requests_used = response.headers.get("x-requests-used")

                if response.status_code == 200:
                    logger.info(
                        f"API call successful | Endpoint: {endpoint} | "
                        f"Used: {self.requests_used} | Remaining: {self.requests_remaining}"
                    )
                    return response.json()

                elif response.status_code == 429:
                    # Rate limited — back off and retry
                    wait_time = self.retry_delay * (attempt + 1)
                    logger.warning(
                        f"Rate limited (429). Retrying in {wait_time}s "
                        f"(attempt {attempt + 1}/{self.max_retries})"
                    )
                    time.sleep(wait_time)
                    continue

                elif response.status_code == 401:
                    raise OddsAPIError(401, "Invalid API key.")

                elif response.status_code == 422:
                    raise OddsAPIError(422, f"Invalid parameters: {response.text}")

                else:
                    raise OddsAPIError(response.status_code, response.text)

            except requests.exceptions.Timeout:
                logger.warning(f"Request timeout (attempt {attempt + 1}/{self.max_retries})")
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(self.retry_delay)

            except requests.exceptions.ConnectionError as e:
                logger.error(f"Connection error: {e}")
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(self.retry_delay)

        raise OddsAPIError(429, "Max retries exceeded due to rate limiting.")

    # ------------------------------------------------------------------ #
    #  Core Endpoints
    # ------------------------------------------------------------------ #

    def get_sports(self, all_sports: bool = False) -> list[dict]:
        """
        List in-season sports. Free — does not count against quota.
        """
        params = {}
        if all_sports:
            params["all"] = "true"
        return self._request("sports", params)

    def is_ncaab_active(self) -> bool:
        """Check whether NCAAB is currently in-season."""
        sports = self.get_sports()
        for sport in sports:
            if sport["key"] == SPORT:
                return sport.get("active", False)
        return False

    def get_ncaab_events(self) -> list[dict]:
        """
        List upcoming/live NCAAB events with IDs. Free — no quota cost.
        """
        return self._request(f"sports/{SPORT}/events", {"dateFormat": "iso"})

    def get_ncaab_odds(
        self,
        regions: str = "us",
        markets: Optional[list[str]] = None,
        odds_format: str = "american",
        bookmakers: Optional[list[str]] = None,
        event_ids: Optional[list[str]] = None,
        commence_time_from: Optional[str] = None,
        commence_time_to: Optional[str] = None,
    ) -> list[dict]:
        """
        Get NCAAB odds for upcoming and live games.

        Args:
            regions: Bookmaker region(s). 'us', 'us2', 'uk', 'au', 'eu'.
            markets: List of markets. Defaults to ['h2h', 'spreads'].
            odds_format: 'american' or 'decimal'. Default 'american'.
            bookmakers: Optional list of specific bookmaker keys.
            event_ids: Optional list of 32-char event IDs to filter.
            commence_time_from: ISO 8601 filter (start).
            commence_time_to: ISO 8601 filter (end).

        Returns:
            List of event dicts with bookmaker odds.

        Quota cost: [number of regions] × [number of markets returned].
                    e.g. 1 region, 2 markets = 2 credits.
        """
        if markets is None:
            markets = ["h2h", "spreads"]

        params = {
            "regions": regions,
            "markets": ",".join(markets),
            "oddsFormat": odds_format,
            "dateFormat": "iso",
        }

        if bookmakers:
            params["bookmakers"] = ",".join(bookmakers)
        if event_ids:
            params["eventIds"] = ",".join(event_ids)
        if commence_time_from:
            params["commenceTimeFrom"] = commence_time_from
        if commence_time_to:
            params["commenceTimeTo"] = commence_time_to

        return self._request(f"sports/{SPORT}/odds", params)

    def get_ncaab_scores(self, days_from: Optional[int] = None) -> list[dict]:
        """
        Get NCAAB scores for live and recently completed games.

        Args:
            days_from: Number of past days to include completed games (1-3).
                       Omit to get only live/upcoming games.

        Returns:
            List of event dicts with scores.

        Quota cost: 2 if days_from is set, 1 otherwise.
        """
        params = {"dateFormat": "iso"}
        if days_from is not None:
            if not 1 <= days_from <= 3:
                raise ValueError("days_from must be between 1 and 3")
            params["daysFrom"] = str(days_from)
        return self._request(f"sports/{SPORT}/scores", params)

    # ------------------------------------------------------------------ #
    #  Convenience / Parsing Helpers
    # ------------------------------------------------------------------ #

    def get_quota_status(self) -> dict:
        """Return current quota usage (from last API response headers)."""
        return {
            "requests_used": self.requests_used,
            "requests_remaining": self.requests_remaining,
        }

    @staticmethod
    def extract_best_odds(event: dict, market: str = "h2h") -> dict | None:
        """
        Find the most favorable odds across all bookmakers for a given event
        and market. Returns dict with home/away team names, best prices, 
        and which bookmaker offered them.
        """
        home = event["home_team"]
        away = event["away_team"]
        best_home = {"price": None, "bookmaker": None, "point": None}
        best_away = {"price": None, "bookmaker": None, "point": None}

        for bookmaker in event.get("bookmakers", []):
            for mkt in bookmaker.get("markets", []):
                if mkt["key"] != market:
                    continue
                for outcome in mkt["outcomes"]:
                    if outcome["name"] == home:
                        if best_home["price"] is None or outcome["price"] > best_home["price"]:
                            best_home["price"] = outcome["price"]
                            best_home["bookmaker"] = bookmaker["title"]
                            best_home["point"] = outcome.get("point")
                    elif outcome["name"] == away:
                        if best_away["price"] is None or outcome["price"] > best_away["price"]:
                            best_away["price"] = outcome["price"]
                            best_away["bookmaker"] = bookmaker["title"]
                            best_away["point"] = outcome.get("point")

        if best_home["price"] is None and best_away["price"] is None:
            return None

        return {
            "home_team": home,
            "away_team": away,
            "home_best": best_home,
            "away_best": best_away,
        }

    @staticmethod
    def determine_winner(score_event: dict) -> dict | None:
        """
        Determine the winner from a completed scores event.
        
        Returns:
            dict with 'winner', 'loser', 'winner_score', 'loser_score',
            or None if game isn't completed.
        """
        if not score_event.get("completed") or not score_event.get("scores"):
            return None

        scores = {s["name"]: int(s["score"]) for s in score_event["scores"]}
        teams = list(scores.keys())

        if len(teams) != 2:
            return None

        if scores[teams[0]] > scores[teams[1]]:
            winner, loser = teams[0], teams[1]
        else:
            winner, loser = teams[1], teams[0]

        return {
            "winner": winner,
            "loser": loser,
            "winner_score": scores[winner],
            "loser_score": scores[loser],
        }

    @staticmethod
    def american_to_implied_probability(american_odds: int) -> float:
        """
        Convert American odds to implied probability (0-1).
        Useful for ranking picks in a survivor pool by 'safeness'.
        """
        if american_odds < 0:
            return abs(american_odds) / (abs(american_odds) + 100)
        else:
            return 100 / (american_odds + 100)
```

### 5.3 Usage Examples

```python
"""
examples.py — Using the OddsAPIClient for a March Madness survivor pool.
"""

from the_odds_api import OddsAPIClient
import json

API_KEY = "eef96f98f903e4af4bfdeb928295dec5"

client = OddsAPIClient(api_key=API_KEY)


# -----------------------------------------------------------
# Example 1: Check if NCAAB season is active
# -----------------------------------------------------------
if client.is_ncaab_active():
    print("NCAAB is in season!")
else:
    print("NCAAB is not currently in season.")


# -----------------------------------------------------------
# Example 2: Get moneyline + spread odds for all NCAAB games
# -----------------------------------------------------------
odds_data = client.get_ncaab_odds(
    regions="us",
    markets=["h2h", "spreads"],
    odds_format="american",
)

for event in odds_data:
    print(f"\n{event['away_team']} @ {event['home_team']}")
    print(f"  Start: {event['commence_time']}")
    print(f"  Event ID: {event['id']}")

    # Show odds from each bookmaker
    for bk in event.get("bookmakers", []):
        print(f"  [{bk['title']}]")
        for mkt in bk["markets"]:
            if mkt["key"] == "h2h":
                for o in mkt["outcomes"]:
                    print(f"    Moneyline — {o['name']}: {o['price']}")
            elif mkt["key"] == "spreads":
                for o in mkt["outcomes"]:
                    print(f"    Spread — {o['name']}: {o['point']} ({o['price']})")


# -----------------------------------------------------------
# Example 3: Find the "safest" pick for a survivor pool
# -----------------------------------------------------------
ranked_picks = []
for event in odds_data:
    best = client.extract_best_odds(event, market="h2h")
    if best:
        # The bigger the implied probability, the "safer" the pick
        for side in ["home_best", "away_best"]:
            team = best["home_team"] if side == "home_best" else best["away_team"]
            price = best[side]["price"]
            if price is not None:
                prob = client.american_to_implied_probability(price)
                ranked_picks.append({
                    "team": team,
                    "opponent": best["away_team"] if side == "home_best" else best["home_team"],
                    "moneyline": price,
                    "implied_prob": round(prob, 4),
                    "bookmaker": best[side]["bookmaker"],
                })

# Sort by implied probability descending (most likely to win first)
ranked_picks.sort(key=lambda x: x["implied_prob"], reverse=True)

print("\n--- SURVIVOR POOL RANKINGS (safest picks) ---")
for i, pick in enumerate(ranked_picks[:10], 1):
    print(
        f"{i}. {pick['team']} vs {pick['opponent']} | "
        f"ML: {pick['moneyline']} | "
        f"Win Prob: {pick['implied_prob']:.1%} | "
        f"via {pick['bookmaker']}"
    )


# -----------------------------------------------------------
# Example 4: Get recent scores / results
# -----------------------------------------------------------
scores_data = client.get_ncaab_scores(days_from=3)

print("\n--- RECENT RESULTS ---")
for event in scores_data:
    result = client.determine_winner(event)
    if result:
        print(
            f"  {result['winner']} {result['winner_score']} — "
            f"{result['loser']} {result['loser_score']}  (FINAL)"
        )
    elif event.get("scores"):
        # Live game
        score_str = " | ".join(f"{s['name']}: {s['score']}" for s in event["scores"])
        print(f"  LIVE: {score_str}")
    else:
        print(f"  UPCOMING: {event['away_team']} @ {event['home_team']} — {event['commence_time']}")


# -----------------------------------------------------------
# Example 5: Check quota usage
# -----------------------------------------------------------
quota = client.get_quota_status()
print(f"\nQuota — Used: {quota['requests_used']} | Remaining: {quota['requests_remaining']}")
```

### 5.4 Scheduled Data Fetcher (Cron-Friendly)

```python
"""
fetch_and_store.py — Fetch NCAAB odds and scores, save to JSON files.
Designed to be run on a schedule (e.g. cron every 30 minutes during game days).
"""

import json
import os
from datetime import datetime, timezone
from the_odds_api import OddsAPIClient

API_KEY = os.environ.get("ODDS_API_KEY", "eef96f98f903e4af4bfdeb928295dec5")
DATA_DIR = "data"

os.makedirs(DATA_DIR, exist_ok=True)

client = OddsAPIClient(api_key=API_KEY)

timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

# 1. Fetch odds (h2h + spreads in one call to save quota)
try:
    odds = client.get_ncaab_odds(
        regions="us",
        markets=["h2h", "spreads"],
        odds_format="american",
    )
    odds_file = os.path.join(DATA_DIR, f"ncaab_odds_{timestamp}.json")
    with open(odds_file, "w") as f:
        json.dump(odds, f, indent=2)
    print(f"Saved {len(odds)} events with odds → {odds_file}")
except Exception as e:
    print(f"Error fetching odds: {e}")

# 2. Fetch scores (with 3 days of completed games)
try:
    scores = client.get_ncaab_scores(days_from=3)
    scores_file = os.path.join(DATA_DIR, f"ncaab_scores_{timestamp}.json")
    with open(scores_file, "w") as f:
        json.dump(scores, f, indent=2)
    print(f"Saved {len(scores)} events with scores → {scores_file}")
except Exception as e:
    print(f"Error fetching scores: {e}")

# 3. Log quota
quota = client.get_quota_status()
print(f"Quota — Used: {quota['requests_used']} | Remaining: {quota['requests_remaining']}")
```

---

## 6. Usage Quotas and Pricing

### Plans

| Plan | Monthly Quota | Price | Historical Access |
|------|--------------|-------|-------------------|
| **Free** | 500 requests | $0 | No |
| **Rookie** | 20,000 requests | $20/mo | Yes |
| **Champion** | 90,000 requests | $49/mo | Yes |
| **Superstar** | 4,500,000 requests | $99/mo | Yes |
| **Legend** | 12,000,000 requests | $199/mo | Yes |

### Quota Cost Per Endpoint

| Endpoint | Cost Formula |
|----------|-------------|
| `/v4/sports/` | **Free** |
| `/v4/sports/{sport}/events/` | **Free** |
| `/v4/sports/{sport}/odds/` | `[# markets returned] × [# regions]` |
| `/v4/sports/{sport}/scores/` | 1 (live only) or 2 (with `daysFrom`) |
| `/v4/sports/{sport}/events/{id}/odds/` | `10 × [# markets] × [# regions]` |
| `/v4/historical/...` | `10 × [# markets] × [# regions]` |

**Important:** The cost is based on the number of *unique markets actually returned* in the response, not the number requested. If you request 5 markets but data is only available for 2, you're charged for 2. Responses with empty data do **not** count against the quota.

### Quota Reset

Quotas reset on the **1st of every month**.

---

## 7. Rate Limits

- **Rate limit:** 30 requests per second (all plans).
- **HTTP 429** is returned when rate-limited.
- Retries should back off for 2+ seconds.
- Even below the limit, bursts can trigger 429s during scaling events.
- Combine markets into single requests (e.g. `markets=h2h,spreads` instead of separate calls).
- Combine regions similarly (e.g. `regions=us,uk`).

---

## 8. Best Practices for Efficient API Usage

### Minimize Quota Consumption

1. **Combine markets in one request:** `markets=h2h,spreads` costs 2 credits in a single call — the same as making 2 separate calls, but uses only 1 of your 30/sec rate limit slots.

2. **Use the free endpoints first:** `/sports/` and `/events/` cost nothing. Use them to check if NCAAB is active and to get event IDs before making paid calls.

3. **Cache aggressively:** Odds typically update every 1–5 minutes. For a survivor pool, fetching every 15–30 minutes during game days is more than sufficient.

4. **Use `eventIds` to filter:** If you only care about specific tournament games, filter by event ID instead of pulling all NCAAB games.

5. **Use `commenceTimeFrom`/`commenceTimeTo`:** Filter to only the date range you need (e.g., today's games only).

6. **Track your quota via response headers:** Always log `x-requests-remaining` so you don't accidentally exhaust your monthly allocation.

### Survivor Pool Polling Strategy

For a March Madness survivor pool, you likely need:

- **Pre-game:** Odds data once or twice per day to rank picks. (~2–4 credits per fetch)
- **During games:** Scores every 5–10 minutes for live updates. (~1–2 credits per fetch)
- **Post-game:** Scores with `daysFrom=1` to confirm results. (~2 credits per fetch)

**Monthly budget estimate for the tournament (~3 weeks):**

| Activity | Frequency | Credits/Call | Total |
|----------|-----------|-------------|-------|
| Odds (daily) | 2×/day × 21 days | 2 | ~84 |
| Scores (game days) | 12×/day × 15 days | 2 | ~360 |
| Events (free) | As needed | 0 | 0 |
| **Total** | | | **~444** |

This fits comfortably within the **free tier** (500/month). If you need higher frequency or multiple regions, upgrade to Rookie ($20/mo).

### Error Handling Checklist

- Always handle HTTP 429 with exponential backoff
- Handle HTTP 401 (invalid/expired API key)
- Handle HTTP 422 (bad parameters — e.g., sport not in season)
- Check for empty responses (`[]`) gracefully — sport may be between rounds
- Validate `scores` is not `null` before parsing
- Scores are returned as **strings** — cast to `int` when doing comparisons

---

## 9. Important Notes and Caveats

1. **NCAAB availability is seasonal.** The `basketball_ncaab` sport key will only return data when college basketball is in season (roughly November through April). Use the `/sports/` endpoint to confirm.

2. **Team names must match exactly.** The API uses full team names (e.g., "Duke Blue Devils", not "Duke"). Store and compare using the exact strings from the API.

3. **Live scores update ~every 30 seconds.** Don't poll more frequently than this — you'll waste quota for no additional data.

4. **The scores endpoint only goes back 3 days.** For anything older, you'd need the historical endpoints (paid plans only, higher quota cost).

5. **Bookmaker availability varies.** Not all bookmakers cover all NCAAB games, especially early-round tournament games between smaller programs. Always handle cases where a bookmaker or market has no data.

6. **No authentication header needed.** The API key goes in the query string (`?apiKey=...`), not in headers. Keep it out of client-side code.

7. **Odds format matters for parsing.** American odds use different math than decimal. The helper function `american_to_implied_probability()` in the client handles this.

---

## 10. Quick Reference: cURL Examples

### Get NCAAB moneyline + spread odds
```bash
curl "https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds/?apiKey=eef96f98f903e4af4bfdeb928295dec5&regions=us&markets=h2h,spreads&oddsFormat=american"
```

### Get NCAAB scores (last 3 days)
```bash
curl "https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores/?apiKey=eef96f98f903e4af4bfdeb928295dec5&daysFrom=3"
```

### List all in-season sports
```bash
curl "https://api.the-odds-api.com/v4/sports/?apiKey=eef96f98f903e4af4bfdeb928295dec5"
```

### List NCAAB events (free)
```bash
curl "https://api.the-odds-api.com/v4/sports/basketball_ncaab/events/?apiKey=eef96f98f903e4af4bfdeb928295dec5"
```
