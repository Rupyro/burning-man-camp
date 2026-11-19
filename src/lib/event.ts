// The camp's event (camp.config.ts event.pack → camp-events/<event>/pack.ts): import its name and
// words from here instead of writing "Burning Man" or "AfrikaBurn" in the app.

import config from "../../camp.config";
import { EVENT_PACKS } from "../../camp-events";

export const EVENT = EVENT_PACKS[config.event.pack];
/** "Burning Man" or "AfrikaBurn". */
export const EVENT_NAME = EVENT.words.name;
/** Where camp is: "Black Rock City" or "Tankwa". */
export const EVENT_SITE = EVENT.words.site;
