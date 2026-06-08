# Weather Mail

A lightweight Cloudflare Worker that sends a daily weather forecast email using official Met Éireann Open Data feeds.

The email combines:

* Point forecast data for a configurable location
* Regional forecast text
* National forecast text

The result is a concise weather briefing delivered directly to your inbox.

## Features

* Runs entirely on Cloudflare Workers
* Uses official Met Éireann Open Data feeds
* Configurable forecast location via latitude and longitude
* Regional and national forecast summaries
* Point forecast summary (temperature, rain risk, wind)
* Multiple daily delivery times
* Multiple email recipients
* Configurable sender address
* Automatic DST handling using Europe/Dublin timezone
* Retry logic for intermittent forecast API issues
* Fallback email when point forecast data is unavailable
* Test endpoint for validation

## Example Email

```text
🌦️ TODAY AT A GLANCE
===================================

🌡️ 10-16°C
🌧️ Rain risk: 71%
💨 Wind: 23 km/h

DUBLIN FORECAST
===============

Today
-----
Today will be cloudy with outbreaks of rain and drizzle...

Tonight
-------
Tonight will be dry and cloudy with limited clear breaks...

Tomorrow
--------
Tomorrow will be another dull day...

NATIONAL FORECAST
=================

Today
-----
Mostly cloudy with scattered showers...

Tonight
-------
Becoming mostly cloudy tonight...

Tomorrow
--------
A cloudy day with outbreaks of rain...
```

## Data Sources

### Point Forecast API

```text
http://openaccess.pf.api.met.ie/metno-wdb2ts/locationforecast
```

### Text Forecasts

```text
https://www.met.ie/Open_Data/json/Dublin.json
https://www.met.ie/Open_Data/json/National.json
```

All weather data is provided by Met Éireann.

## Requirements

* Node.js 20+
* Cloudflare account
* Wrangler CLI
* SMTP2GO account (or compatible email provider)

## Installation

Clone the repository:

```bash
git clone https://github.com/<your-user>/weather-mail.git
cd weather-mail
```

Install dependencies:

```bash
npm install
```

## Configuration

The worker is configured using Cloudflare Worker variables and secrets.

### Variables

Configure these values in `wrangler.jsonc`:

```json
{
  "vars": {
    "MAIL_TO": "alice@example.com,bob@example.com",
    "MAIL_FROM": "weather@example.com",
    "LAT": "53.3250",
    "LON": "-6.2520",
    "SEND_HOURS_LOCAL": "7"
  }
}
```

| Variable           | Description                                                           |
| ------------------ | --------------------------------------------------------------------- |
| `MAIL_TO`          | Comma-separated list of recipient email addresses                     |
| `MAIL_FROM`        | Sender address used for outgoing emails                               |
| `LAT`              | Latitude of the forecast location                                     |
| `LON`              | Longitude of the forecast location                                    |
| `SEND_HOURS_LOCAL` | Comma-separated list of local Dublin hours when emails should be sent |

### Examples

Single morning email:

```json
{
  "SEND_HOURS_LOCAL": "7"
}
```

Morning and afternoon updates:

```json
{
  "SEND_HOURS_LOCAL": "7,16"
}
```

Three daily updates:

```json
{
  "SEND_HOURS_LOCAL": "7,12,17"
}
```

The worker automatically converts UTC to the Europe/Dublin timezone, so daylight-saving changes are handled automatically.

### Secrets

Store the SMTP2GO API key as a Cloudflare secret:

```bash
wrangler secret put SMTP2GO_API_KEY
```

The API key is never stored in source control.

## Local Development

Start the worker locally:

```bash
npm run dev
```

## Test Endpoint

The worker exposes a test endpoint:

```bash
curl http://localhost:8787/test
```

or after deployment:

```bash
curl https://your-worker.workers.dev/test
```

For safety, test emails are sent only to the first address listed in `MAIL_TO`.

## Deployment

Deploy the worker:

```bash
npm run deploy
```

## Scheduling

The worker is designed to run every hour:

```json
{
  "triggers": {
    "crons": ["5 * * * *"]
  }
}
```

The configured `SEND_HOURS_LOCAL` values determine when emails are actually sent.

This approach avoids daylight-saving issues and ensures emails are delivered at the desired local Dublin time throughout the year.

## Project Structure

```text
.
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
├── wrangler.jsonc
├── eslint.config.mjs
├── LICENSE
└── README.md
```

## Linting

Run ESLint:

```bash
npm run lint
```

Automatically fix issues:

```bash
npm run lint:fix
```

## License

This project is licensed under the MIT License.

See the LICENSE file for details.

## Disclaimer

This project is not affiliated with Met Éireann.

Weather forecasts are provided by Met Éireann Open Data services. Availability and accuracy depend on the upstream services.

