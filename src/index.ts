export interface Env {
  SMTP2GO_API_KEY: string;
  MAIL_TO: string;
  MAIL_FROM: string;
  LAT?: string;
  LON?: string;
  SEND_HOURS_LOCAL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/test') {
      await sendForecastEmail(env, true);
      return new Response('Test mail sent');
    }

    return new Response('Weather mail worker');
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const now = new Date();

    const dublinHour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Dublin",
        hour: "numeric",
        hour12: false,
      }).format(now)
    );

    const sendHours = (env.SEND_HOURS_LOCAL ?? "7")
      .split(",")
      .map((h) => Number(h.trim()))
      .filter((h) => !Number.isNaN(h));

    if (!sendHours.includes(dublinHour)) {
      return;
    }

    await sendForecastEmail(env);
  },
};

async function sendForecastEmail(env: Env, testMode = false) {
  const [dublinResp, nationalResp] = await Promise.all([
    fetch('https://www.met.ie/Open_Data/json/Dublin.json'),
    fetch('https://www.met.ie/Open_Data/json/National.json'),
  ]);

  const dublin = await dublinResp.json();
  const national = await nationalResp.json();

  let weather = null;

  try {
    weather = await getWeatherWithRetry(env);
  } catch (err) {
    console.log('Weather forecast unavailable', err);
  }

  const subject = weather
    ? `${weather.icon} Today ${weather.maxTemp}°C` +
      (weather.rainProb >= 30 ? ` • ${weather.rainProb}% rain` : '') +
      ` • ${weather.windKmh} km/h`
    : '⚠️ Weather forecast unavailable';

	const headline = weather
	  ? `${weather.icon} TODAY AT A GLANCE
===================================
	
🌡️ ${weather.minTemp}-${weather.maxTemp}°C
🌧️ Rain risk: ${weather.rainProb}%
💨 Wind: ${weather.windKmh} km/h`
    : `⚠️ TODAY AT A GLANCE
===================================

Point forecast unavailable this morning.
Regional and national forecasts are still available.`;

	const body = `
${headline}

DUBLIN FORECAST
===============

${extractForecastText(dublin)}

NATIONAL FORECAST
=================

${extractForecastText(national)}
`;

  const allRecipients = env.MAIL_TO.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const recipients = testMode ? [allRecipients[0]] : allRecipients;

  const payload = {
    api_key: env.SMTP2GO_API_KEY,
    to: recipients,
    sender: env.MAIL_FROM,
    subject,
    text_body: body,
  };

  const resp = await fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  console.log(await resp.text());
}

function extractForecastText(data: any): string {
  const region = data?.forecasts?.[0]?.regions;

  if (!Array.isArray(region)) {
    return 'Forecast unavailable';
  }

  const get = (key: string) => region.find((x: any) => x[key])?.[key] ?? '';

  return `
Today
-----
${get('today')}

Tonight
-------
${get('tonight')}

Tomorrow
--------
${get('tomorrow')}
`;
}

async function getWeatherWithRetry(env: Env, attempts = 3) {
  let lastError;

  const lat = env.LAT ?? "53.3250";
  const lon = env.LON ?? "-6.2520";

  for (let i = 1; i <= attempts; i++) {
    try {
      const resp = await fetch(
        `http://openaccess.pf.api.met.ie/metno-wdb2ts/locationforecast?lat=${lat};long=${lon}`,
        {
          cf: {
            cacheTtl: 0,
            cacheEverything: false,
          },
        },
      );

      const xml = await resp.text();

      const weather = extractToday(xml);

      if (
        Number.isFinite(weather.maxTemp) &&
        Number.isFinite(weather.minTemp)
      ) {
        console.log(`Weather parse succeeded on attempt ${i}`);
        return weather;
      }

      throw new Error('Invalid weather data');
    } catch (err) {
      console.log(`Weather attempt ${i} failed`);

      lastError = err;

      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  throw lastError;
}

function extractToday(xml: string) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Dublin',
  }).format(new Date());

  // const day = new Date().toISOString().slice(0, 10);

  const temps = [
    ...xml.matchAll(
      new RegExp(
        `<time[^>]*from="${day}[^"]*"[^>]*>[\\s\\S]*?<temperature[^>]*value="([0-9.]+)"`,
        'g',
      ),
    ),
  ].map((m) => Number(m[1]));

  const rain = [
    ...xml.matchAll(
      new RegExp(
        `<time[^>]*from="${day}[^"]*"[^>]*>[\\s\\S]*?<precipitation[^>]*probability="([0-9.]+)"`,
        'g',
      ),
    ),
  ].map((m) => Number(m[1]));

  const wind = [
    ...xml.matchAll(
      new RegExp(
        `<time[^>]*from="${day}[^"]*"[^>]*>[\\s\\S]*?<windSpeed[^>]*mps="([0-9.]+)"`,
        'g',
      ),
    ),
  ].map((m) => Number(m[1]) * 3.6);

  if (temps.length === 0) {
    throw new Error('No temperatures found');
  }

  const maxTemp = Math.round(Math.max(...temps));
  const minTemp = Math.round(Math.min(...temps));
  const rainProb = Math.round(Math.max(...rain, 0));
  const windKmh = Math.round(Math.max(...wind, 0));

  const icon =
    rainProb > 60 ? '🌧️' : rainProb > 30 ? '🌦️' : maxTemp > 20 ? '☀️' : '☁️';

  return {
    maxTemp,
    minTemp,
    rainProb,
    windKmh,
    icon,
  };
}
