# Contact Form — EmailJS Setup

## 1. Files created / modified

**Created:**
- `frontend/config.json` — all configurable values (recipient, EmailJS keys, selectors, field ids, messages in AR/EN).
- `frontend/js/contact-form.js` — the entire submission handler. Isolated file, touches nothing else.
- `frontend/CONTACT-FORM-SETUP.md` — this file. The EmailJS notification template lives only here (§3), as a copy-paste block — it's not a project file, since it's pasted directly into the EmailJS dashboard's own editor.

**Modified (two lines each, nothing else):**
- `frontend/index.html` — added the EmailJS SDK `<script>` and `<script src="js/contact-form.js" defer>` immediately before `</body>`.
- `frontend/about.html` — same two lines, after its existing scripts.

No CSS file, no existing JS file (`main.js`, `effects.js`, etc.), and no modal markup were changed.

## 2. Where to get your EmailJS keys

1. Sign in at [emailjs.com](https://www.emailjs.com) → **Email Services** → add a service (e.g. Gmail/SMTP) → copy the **Service ID**.
2. **Email Templates** → create a template → copy the **Template ID** (see field mapping below).
3. **Account → General** → copy your **Public Key**.

Paste all three into `frontend/config.json`:

```json
"emailjs": {
  "publicKey": "YOUR_PUBLIC_KEY",
  "serviceId": "YOUR_SERVICE_ID",
  "templateId": "YOUR_TEMPLATE_ID"
}
```

Until these are filled in, the form will show the "configuration error" message instead of attempting to send (checked explicitly in `contact-form.js`).

## 3. EmailJS template configuration (required)

In the EmailJS template editor, set these three fields on the **Settings** tab so the recipient is driven by the client, not fixed in the dashboard:

```
To Email   = {{to_email}}
From Name  = {{from_name}}
Reply To   = {{reply_to}}
```

Template body: in the EmailJS dashboard, open the template → **Content** editor (the code box, not the visual/drag-drop builder) and paste the block below, replacing whatever is there. It's dark-themed to match the site's brand (Cairo font, gold-on-near-black palette, glass-style card) and fluid-width so it reflows on mobile without needing a `<style>`/media-query block, which a plain content field like EmailJS's doesn't reliably preserve — everything is inline CSS on table cells.

Suggested subject line: `New Contact Message from {{from_name}} — Al Deafah Group`

```html
<div style="background-color:#161311; padding: 32px 16px; font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; margin:0 auto; background-color:#1c1815; border:1px solid #3a352f; border-radius:20px; overflow:hidden;">

    <tr>
      <td style="padding: 28px 32px; border-bottom: 1px solid #3a352f;">
        <div style="font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #d4b06a; font-weight: 700;">
          Al Deafah International Group
        </div>
        <div style="font-size: 11px; letter-spacing: 1px; color: #8a8579; margin-top: 4px;">
          مجموعة الضيافة العالمية
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding: 32px 32px 8px;">
        <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #b89047; font-weight: 700;">
          New Contact Message
        </div>
        <div style="font-size: 22px; font-weight: 800; color: #eae3d9; margin-top: 6px;">
          You've received a new inquiry
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding: 20px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#201a15; border:1px solid #3a352f; border-radius:16px;">
          <tr>
            <td width="64" style="vertical-align:top; padding: 20px 0 20px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="44" height="44" align="center" valign="middle" style="width:44px; height:44px; background-color:#2a2319; border:1px solid #b89047; border-radius:999px; font-size:20px; line-height:44px;">
                    👤
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align:top; padding: 20px 20px 20px 14px;">
              <div style="font-size: 16px; font-weight: 700; color:#eae3d9;">{{from_name}}</div>
              <div style="font-size: 12px; color:#a6a099; margin-top: 6px;">Submitted {{submitted_at}}</div>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 14px;">
                <tr><td style="padding: 4px 0;">
                  <span style="font-size: 11px; color:#726d66; text-transform: uppercase; letter-spacing: 0.5px;">Email</span><br>
                  <a href="mailto:{{from_email}}" style="font-size: 14px; color:#d4b06a; text-decoration: none;">{{from_email}}</a>
                </td></tr>
                <tr><td style="padding: 8px 0 0;">
                  <span style="font-size: 11px; color:#726d66; text-transform: uppercase; letter-spacing: 0.5px;">Mobile</span><br>
                  <a href="tel:{{mobile}}" style="font-size: 14px; color:#d4b06a; text-decoration: none;">{{mobile}}</a>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 20px 32px 0;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color:#726d66; margin-bottom: 8px;">Message</div>
        <div style="font-size: 15px; line-height: 1.8; color:#eae3d9; background-color:#201a15; border-inline-start: 3px solid #b89047; border-radius: 8px; padding: 16px 20px;">
          {{message}}
        </div>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding: 28px 32px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="border-radius: 999px; background-color:#b89047;">
              <a href="mailto:{{from_email}}" style="display:inline-block; padding: 12px 28px; font-size: 14px; font-weight: 700; color:#201a12; text-decoration:none; border-radius: 999px;">
                Reply to {{from_name}}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding: 20px 32px 28px; border-top: 1px dashed #3a352f;">
        <div style="font-size: 11px; color:#726d66; line-height: 1.6;">
          Sent from the contact form at <a href="{{page_url}}" style="color:#a6a099;">{{page_url}}</a>.<br>
          Automated notification for {{to_name}} — reply using the sender's email above, not this address.
        </div>
      </td>
    </tr>

  </table>
</div>
```

**Placeholder → data mapping** — these are the *only* param names `contact-form.js` actually sends; the template must use exactly these (an earlier draft used `{{name}}`/`{{time}}`, which don't exist as params and would render as literal empty text):

| Placeholder | Value |
|---|---|
| `{{from_name}}` | sender's full name |
| `{{from_email}}` | sender's email (also used as the Reply-To, mailto link, and CTA button target) |
| `{{mobile}}` | sender's mobile, normalized to Latin digits |
| `{{message}}` | the message body |
| `{{submitted_at}}` | ISO-8601 timestamp of submission (raw — EmailJS templates can't reformat dates) |
| `{{page_url}}` | the page the form was submitted from (index or about) |
| `{{to_name}}` | `config.contact.destinationName` — shown in the footer |
| `{{to_email}}` | `config.contact.destinationEmail` — used only in the Settings tab (§ above), not printed in the body |

Changing `contact.destinationEmail` in `config.json` changes who receives the mail, with no code edit — the recipient is read from `config.json` at send time and passed as `to_email`.

## 4. ⚠️ SECURITY — read before going live

Because `to_email` is supplied by the browser and the EmailJS **public key** is visible in `config.json` (anyone can view-source it), **anyone can open the browser console on your site, copy the public key, and call EmailJS directly to send mail to any address they choose, using your account's quota and your verified sender identity.** This is inherent to any purely client-side EmailJS integration — there is no backend here to hide the key or check the recipient.

Before this goes live, do **all** of the following in the EmailJS dashboard:

- **Account → Security → Allowed Origins** — restrict sending to your production domain only (e.g. `https://deafahgroup.com`). This is the single most important step; without it, the key works from anywhere.
- **Enable reCAPTCHA** on the template, to block scripted/automated abuse.
- **Set a monthly quota alert** so you're notified if usage spikes unexpectedly.

The honeypot field and the 30-second client-side throttle in `contact-form.js` deter casual bots, but neither is a real security boundary — they run in the browser and can be bypassed by anyone editing the page's JS. The three dashboard settings above are the actual protection.

## 5. Local testing

`fetch()` cannot load `config.json` from a `file://` URL — the page must be served over http(s):

```bash
cd frontend
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html` (or `/about.html`), open the Contact modal, and submit. Check the browser console — `contact-form.js` logs a clear `[contact-form]` prefixed error for any failure (missing SDK, missing config, still-placeholder keys, or a failed send).
