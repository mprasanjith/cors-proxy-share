// Change host appropriately if you run your own Sentry instance.
const sentryHost = "sentry.io";

// Set knownProjectIds to an array with your Sentry project IDs which you
// want to accept through this proxy.
const knownProjectIds = ["4504496775561216"];

const allowCors = (fn) => async (req, res) => {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  // another common pattern; but there might not be origin (for instance call from browser)
  // res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

async function handler(req, res) {
  try {
    const envelope = req.body;
    const pieces = envelope.split("\n");
    const header = JSON.parse(pieces[0]);
    // DSNs are of the form `https://<key>@o<orgId>.ingest.sentry.io/<projectId>`
    const { host, pathname } = new URL(header.dsn);
    // Remove leading slash
    const projectId = pathname.substring(1);

    if (host !== sentryHost) {
      throw new Error(`invalid host: ${host}`);
    }

    if (!knownProjectIds.includes(projectId)) {
      throw new Error(`invalid project id: ${projectId}`);
    }

    const sentryIngestURL = `https://${sentryHost}/api/${projectId}/envelope/`;
    const sentryResponse = await fetch(sentryIngestURL, {
      method: "POST",
      body: envelope,
    });

    // Relay response from Sentry servers to front end
    sentryResponse.headers.forEach(([key, value]) => res.setHeader(key, value));
    res.status(sentryResponse.status).send(sentryResponse.body);
  } catch (e) {
    console.error(e);
    return res.status(400).json({ status: "invalid request" });
  }
}

export default allowCors(handler);
