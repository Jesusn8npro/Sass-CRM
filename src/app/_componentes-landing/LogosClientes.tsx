import "./landing.css";

const ITEMS = [
  "Notion", "HubSpot", "Pipedrive", "Make", "Zapier", "Calendly",
  "Stripe", "Meta", "Twilio", "OpenAI",
  "Notion", "HubSpot", "Pipedrive", "Make", "Zapier", "Calendly",
  "Stripe", "Meta", "Twilio", "OpenAI",
];

export function LogosClientes() {
  return (
    <div className="marquee" aria-label="Integraciones">
      <div className="marquee-track">
        {ITEMS.map((it, i) => (
          <div className="marquee-item" key={i}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>
            {it}
          </div>
        ))}
      </div>
    </div>
  );
}
