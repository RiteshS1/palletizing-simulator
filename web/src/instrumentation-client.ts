// Vercel BotID: an invisible challenge that lets /api/chat reject automated traffic,
// protecting the AI keys without a CAPTCHA.
import { initBotId } from "botid/client/core";

initBotId({ protect: [{ path: "/api/chat", method: "POST" }] });
